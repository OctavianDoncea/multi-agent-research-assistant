import uuid
from pydantic import ValidationError
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user, get_current_user_optional
from app.db.session import get_db
from app.db import crud
from app.db.models import User
from app.schemas import SessionListItem, SessionDetail, Source, ClaimCheck, SessionStep, SessionUpdateRequest
from app.utils.summary_markdown import coerce_summary_markdown
from app.agents.fact_checker import FactCheckerOutput, _normalize_factcheck_payload

router = APIRouter(prefix='/api/sessions', tags=['sessions'])

def _fact_checks_from_agent_steps(steps) -> list[ClaimCheck]:
    out: list[ClaimCheck] = []
    for st in reversed(steps):
        if not st.agent_name.startswith('fact_checker') or not isinstance(st.output, dict):
            continue
        raw = st.output
        if 'items' not in raw and not any(k in raw for k in ('claims', 'fact_checks', 'checks', 'results')):
            continue
        try:
            parsed = FactCheckerOutput.model_validate(_normalize_factcheck_payload(raw))
        except ValidationError:
            continue
        for i in parsed.items:
            out.append(
                ClaimCheck(
                    claim=i.claim,
                    status=i.status,
                    evidence_source_ids=i.evidence_source_ids,
                    notes=i.notes,
                )
            )
        if out:
            break
    return out

def _can_view(session, user: User | None) -> bool:
    if getattr(session, 'is_public', False):
        return True
    if user is not None and session.user_id is not None and session.user_id == user.id:
        return True
    return False

def _is_owner(session, user: User | None) -> bool:
    return user is not None and session.user_id is not None and session.user_id == user.id

async def _session_detail(db: AsyncSession, session_id: uuid.UUID, user: User | None) -> SessionDetail:
    s = await crud.get_session(db, session_id)
    if not s or not _can_view(s, user):
        raise HTTPException(status_code=404, detail='Session not found')

    steps = await crud.get_session_steps(db, session_id)
    sources = await crud.get_session_sources(db, session_id)
    checks = await crud.get_session_fact_checks(db, session_id)
    if not checks:
        checks = _fact_checks_from_agent_steps(steps)

    summary_md = None
    for st in steps:
        if st.agent_name.startswith('summarizer') and st.output and 'answer_markdown' in st.output:
            summary_md = coerce_summary_markdown(st.output.get('answer_markdown'))
            break

    return SessionDetail(
        id=s.id,
        user_query=s.user_query,
        title=getattr(s, 'title', None),
        tags=getattr(s, 'tags', []) or [],
        pinned=getattr(s, 'pinned', False),
        is_public=getattr(s, 'is_public', False),
        is_owner=_is_owner(s, user),
        status=s.status,
        error=s.error,
        created_at=s.created_at,
        summary_markdown=summary_md,
        steps=[
            SessionStep(
                agent_name=st.agent_name,
                input=st.input,
                output=st.output,
                tokens_used=st.tokens_used,
                duration_ms=st.duration_ms,
                created_at=st.created_at,
            )
            for st in steps
        ],
        sources=[
            Source(
                source_id=so.source_id,
                url=so.url,
                title=so.title,
                snippet=so.snippet,
                extracted_text=so.content_excerpt,
            )
            for so in sources
        ],
        fact_checks=[
            ClaimCheck(
                claim=fc.claim,
                status=fc.status,  # type: ignore
                evidence_source_ids=fc.evidence_source_ids,
                notes=fc.notes,
            )
            for fc in checks
        ],
    )

@router.get('', response_model=list[SessionListItem])
async def list_sessions(
    limit: int = Query(default=50, ge=1, le=200),
    q: str | None = Query(default=None, max_length=200),
    tag: str | None = Query(default=None, max_length=50),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    sessions = await crud.list_sessions(db, user_id=user.id, limit=limit, q=q, tag=tag)
    return [SessionListItem(
        id=s.id,
        user_query=s.user_query,
        title=getattr(s, 'title', None),
        tags=getattr(s, 'tags', []) or [],
        pinned=getattr(s, 'pinned', False),
        is_public=getattr(s, 'is_public', False),
        status=s.status,
        created_at=s.created_at,
    ) for s in sessions]

@router.get('/{session_id}', response_model=SessionDetail)
async def get_session_detail(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
):
    return await _session_detail(db, session_id, user)

@router.patch('/{session_id}', response_model=SessionDetail)
async def update_session(
    session_id: uuid.UUID,
    req: SessionUpdateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    s = await crud.get_session(db, session_id)
    if not s or not _is_owner(s, user):
        raise HTTPException(status_code=404, detail='Session not found')

    await crud.update_session_meta(
        db,
        session_id,
        title=req.title,
        pinned=req.pinned,
        tags=req.tags,
        is_public=req.is_public,
    )

    return await _session_detail(db, session_id, user)