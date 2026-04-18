import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.db import crud
from app.schemas import SessionListItem, SessionDetail, Source, ClaimCheck, SessionStep

router = APIRouter(prefic='/api/sessions', tags=['sessions'])


@router.get('', response_model=list[SessionListItem])
async def list_sessions(db: AsyncSession = Depends(get_db)):
    sessions = await crud.list_sessions(db)

    return [SessionListItem(id=s.id, user_query=s.user_query, status=s.status, created_at=s.created_at) for s in sessions]

@router.get('/{session_id}', response_model=SessionDetail)
async def get_session_detail(session_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    s = await crud.get_session(db, session_id)
    if not s:
        raise HTTPException(status_code=404, detail='Session not found')

    steps = await crud.get_session_steps(db, session_id)
    sources = await crud.get_session_sources(db, session_id)
    checks = await crud.get_session_fact_checks(db, session_id)

    # Best-effort summary: take from summarizer step output
    summary_md = None
    for st in steps:
        if st.agent_name.startswith('summarizer') and st.output and 'answer_markdown' in st.output:
            summary_md = st.output.get('answer_markdown')
            break

    return SessionDetail(
        id=s.id,
        user_query=s.user_query,
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