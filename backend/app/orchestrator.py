import time
import uuid
import re
from typing import Any
from collections.abc import Awaitable, Callable
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.schemas import AgentStepDebug, Source, ClaimCheck
from app.utils.text import preview, truncate
from app.utils.tokens import estimate_tokens
from app.agents.planner import run_planner
from app.agents.researcher import run_researcher, ResearchBundle
from app.agents.summarizer import run_summarizer
from app.agents.fact_checker import run_fact_checker
from app.db import crud

ProgressEmitter = Callable[[str, dict], Awaitable[None]]

def _now_ms() -> int:
    return int(time.time() * 1000)


_BRACKET_RE = re.compile(r"\[([^\]]+)\]")
_SOURCE_ID_RE = re.compile(r"\bS\d+(?:-\d+)*\b")


def extract_citation_ids(markdown: str) -> set[str]:
    ids: set[str] = set()
    if not markdown:
        return ids
    for content in _BRACKET_RE.findall(markdown):
        for sid in _SOURCE_ID_RE.findall(content):
            ids.add(sid)
    return ids

async def _emit(emit: ProgressEmitter | None, *, stage: str, status: str, **extra: Any):
    if not emit:
        return
    await emit('progress', {'stage': stage, 'status': status, **extra})

def _pack_sources_for_llm(bundles: list[ResearchBundle]) -> list[tuple[str, str, str | None]]:
    """
    Returns list of (source_id, url, extracted_text) clipped to MAX_TOTAL_SOURCE_CHARS.
    """
    packed: list[tuple[str, str, str | None]] = []
    total_chars = 0

    all_sources = []
    for b in bundles:
        for s in b.sources:
            all_sources.append(s)

    all_sources.sort(key=lambda s: 0 if s.extracted_text else 1)

    for s in all_sources:
        if not s.extracted_text:
            continue
        remaining = settings.max_total_source_chars - total_chars
        if remaining <= 0:
            break
        clipped = truncate(s.extracted_text, min(len(s.extracted_text), remaining))
        packed.append((s.source_id, s.url, clipped))
        total_chars += len(clipped)

    return packed


async def _persist_step(db: AsyncSession | None, session_id: uuid.UUID | None, *, agent_name: str, input_obj: dict | None, output_obj: dict | None, duration_ms: int,
) -> None:
    if not db or not session_id:
        return
    # token count is optional; store an estimate for interviewer-friendly telemetry
    tokens_used = None
    try:
        tokens_used = estimate_tokens(str(output_obj or "")) if output_obj is not None else None
    except Exception:
        tokens_used = None

    await crud.add_agent_step(
        db,
        session_id=session_id,
        agent_name=agent_name,
        input=input_obj,
        output=output_obj,
        tokens_used=tokens_used,
        duration_ms=duration_ms,
    )


async def run_research_pipeline(
    query: str,
    max_subquestions: int | None = None,
    *,
    db: AsyncSession | None = None,
    session_id: uuid.UUID | None = None,
    emit: ProgressEmitter | None = None
) -> dict[str, Any]:
    request_id = str(uuid.uuid4())
    debug_steps: list[AgentStepDebug] = []

    max_subq = max_subquestions or settings.max_subquestions

    try:
        await _emit(emit, stage='planner', status='start')
        # 1) Planner
        t0 = _now_ms()
        planner_out, planner_provider = await run_planner(query, max_subquestions=max_subq)
        d0 = _now_ms() - t0

        debug_steps.append(
            AgentStepDebug(
                agent=f"planner({planner_provider})",
                input_preview=preview(query),
                output_preview=preview(str(planner_out.model_dump())),
                duration_ms=d0,
            )
        )
        await _persist_step(
            db,
            session_id,
            agent_name=f"planner({planner_provider})",
            input_obj={"query": query, "max_subquestions": max_subq},
            output_obj=planner_out.model_dump(),
            duration_ms=d0,
        )

        if planner_out.needs_clarification:
            await _emit(emit, stage='planner', status='needs_clarification')
            if db and session_id:
                await crud.mark_session_completed(db, session_id)
            return {
                "request_id": request_id,
                "needs_clarification": True,
                "clarifying_questions": planner_out.clarifying_questions,
                "subquestions": [],
                "summary_markdown": None,
                "sources": [],
                "fact_checks": [],
                "debug_steps": debug_steps,
            }

        await _emit(emit, stage='planner', status='done')

        subquestions = planner_out.subquestions[:max_subq]

        # 2) Researcher
        await _emit(emit, stage='researcher', status='start', subquestions=len(subquestions))
        bundles: list[ResearchBundle] = []
        t1 = _now_ms()
        for i, sq in enumerate(subquestions):
            await _emit(emit, stage='researcher', status='subquestion_start', index=1, subquestion=sq)
            bundle = await run_researcher(sq, source_id_prefix=f"S{i+1}-")
            bundles.append(bundle)
            extracted_count = sum(1 for s in bundle.sources if s.extracted_text)
            await _emit(emit, stage='researcher', status='subquestion_done', index=i, subquestions=sq, sources=len(bundles.sources), extracted=extracted_count)
        d1 = _now_ms() - t1

        debug_steps.append(
            AgentStepDebug(
                agent="researcher(search+extract)",
                input_preview=preview(str(subquestions)),
                output_preview=preview(f"bundles={len(bundles)}"),
                duration_ms=d1,
            )
        )

        researcher_output = {
            "subquestions": subquestions,
            "bundles": [
                {
                    "subquestion": b.subquestion,
                    "sources": [
                        {
                            "source_id": s.source_id,
                            "url": s.url,
                            "title": s.title,
                            "snippet": s.snippet,
                            "has_extracted_text": bool(s.extracted_text),
                            "extracted_len": len(s.extracted_text or ""),
                        }
                        for s in b.sources
                    ],
                }
                for b in bundles
            ],
        }
        await _persist_step(
            db,
            session_id,
            agent_name="researcher(search+extract)",
            input_obj={"subquestions": subquestions},
            output_obj=researcher_output,
            duration_ms=d1,
        )
        await _emit(emit, stage='researcher', status='done')

        # Flatten sources for API response
        api_sources: list[Source] = []
        for b in bundles:
            for s in b.sources:
                api_sources.append(
                    Source(
                        source_id=s.source_id,
                        url=s.url,
                        title=s.title,
                        snippet=s.snippet,
                        extracted_text=s.extracted_text,
                    )
                )

        # Persist sources (store excerpt to keep DB reasonable)
        if db and session_id:
            await crud.replace_sources(
                db,
                session_id,
                sources=[
                    {
                        "source_id": s.source_id,
                        "url": s.url,
                        #"title": s.title,
                        "snippet": s.snippet,
                        "content_excerpt": truncate(s.extracted_text, 8000) if s.extracted_text else None,
                    }
                    for s in api_sources
                ],
            )

        # If no extracted content, return message
        packed_sources = _pack_sources_for_llm(bundles)
        if not packed_sources:
            await _emit(emit, stage='summarizer', status='skipped_no_sources')
            if db and session_id:
                await crud.mark_session_completed(db, session_id)
            return {
                "request_id": request_id,
                "needs_clarification": False,
                "clarifying_questions": [],
                "subquestions": subquestions,
                "summary_markdown": "No readable source content could be extracted from the top search results. Try a different query or more specific keywords.",
                "sources": api_sources,
                "fact_checks": [],
                "debug_steps": debug_steps,
            }

        allowed_ids = sorted({sid for (sid, _url, text) in packed_sources if text})
        allowed_set = set(allowed_ids)

        # 3) Summarizer
        await _emit(emit, stge='summarizer', status='start', sources=len(allowed_ids))
        t2 = _now_ms()
        summarizer_out, sum_provider = await run_summarizer(
            query,
            packed_sources,
            allowed_source_ids=allowed_ids,
        )
        d2 = _now_ms() - t2

        debug_steps.append(
            AgentStepDebug(
                agent=f"summarizer({sum_provider})",
                input_preview=preview(f"sources_chars={sum(len(t or '') for _,_,t in packed_sources)}"),
                output_preview=preview(summarizer_out.answer_markdown),
                duration_ms=d2,
            )
        )
        await _persist_step(
            db,
            session_id,
            agent_name=f"summarizer({sum_provider})",
            input_obj={"query": query, "allowed_source_ids": allowed_ids},
            output_obj=summarizer_out.model_dump(),
            duration_ms=d2,
        )

        # Quality guard: citations
        cited_ids = extract_citation_ids(summarizer_out.answer_markdown or "")
        invalid_citations = sorted([cid for cid in cited_ids if cid not in allowed_set])

        if (not cited_ids) or invalid_citations:
            await _emit(emit, stage='summarizer', status='repair_start', invalid=invalid_citations)
            t2b = _now_ms()
            repair_msg = (
                "Your previous answer had citation issues.\n"
                f"- Invalid citations used: {invalid_citations}\n"
                f"- Allowed citation IDs are: {allowed_ids}\n\n"
                "Rewrite the answer_markdown to include citations using ONLY allowed IDs (e.g., [S1-1]). "
                "Do not use [S1] or any IDs not in the allowed list. Ensure the main claims are cited."
            )
            summarizer_out, sum_provider2 = await run_summarizer(
                query,
                packed_sources,
                allowed_source_ids=allowed_ids,
                repair_instructions=repair_msg,
            )
            d2b = _now_ms() - t2b
            debug_steps.append(
                AgentStepDebug(
                    agent=f"summarizer_repair({sum_provider2})",
                    input_preview=preview(repair_msg),
                    output_preview=preview(summarizer_out.answer_markdown),
                    duration_ms=d2b,
                )
            )
            await _persist_step(
                db,
                session_id,
                agent_name=f"summarizer_repair({sum_provider2})",
                input_obj={"repair_instructions": repair_msg, "allowed_source_ids": allowed_ids},
                output_obj=summarizer_out.model_dump(),
                duration_ms=d2b,
            )
        await _emit(emit, stage='summarizer', status='done')

        # 4) Fact-checker
        await _emit(emit, stage='fact_checker', status='start')
        t3 = _now_ms()
        fact_out, fc_provider = await run_fact_checker(
            summarizer_out.answer_markdown,
            packed_sources,
            allowed_source_ids=allowed_ids,
        )
        d3 = _now_ms() - t3

        debug_steps.append(
            AgentStepDebug(
                agent=f"fact_checker({fc_provider})",
                input_preview=preview(summarizer_out.answer_markdown),
                output_preview=preview(str([x.model_dump() for x in fact_out.items])),
                duration_ms=d3,
            )
        )
        await _persist_step(
            db,
            session_id,
            agent_name=f"fact_checker({fc_provider})",
            input_obj={"allowed_source_ids": allowed_ids},
            output_obj={"items": [i.model_dump() for i in fact_out.items]},
            duration_ms=d3,
        )

        invalid_evidence_ids = sorted(
            {
                eid
                for item in fact_out.items
                for eid in (item.evidence_source_ids or [])
                if eid not in allowed_set
            }
        )

        if invalid_evidence_ids:
            await _emit(emit, stage='fact_checker', status='repair_start', invalid=invalid_evidence_ids)
            t3b = _now_ms()
            repair_msg = (
                "Your previous output used invalid evidence_source_ids.\n"
                f"- Invalid evidence IDs: {invalid_evidence_ids}\n"
                f"- Allowed IDs are: {allowed_ids}\n\n"
                "Recompute the fact-check items. evidence_source_ids must contain ONLY allowed IDs."
            )
            fact_out, fc_provider2 = await run_fact_checker(
                summarizer_out.answer_markdown,
                packed_sources,
                allowed_source_ids=allowed_ids,
                repair_instructions=repair_msg,
            )
            d3b = _now_ms() - t3b
            debug_steps.append(
                AgentStepDebug(
                    agent=f"fact_checker_repair({fc_provider2})",
                    input_preview=preview(repair_msg),
                    output_preview=preview(str([x.model_dump() for x in fact_out.items])),
                    duration_ms=d3b,
                )
            )
            await _persist_step(
                db,
                session_id,
                agent_name=f"fact_checker_repair({fc_provider2})",
                input_obj={"repair_instructions": repair_msg, "allowed_source_ids": allowed_ids},
                output_obj={"items": [i.model_dump() for i in fact_out.items]},
                duration_ms=d3b,
            )
            await _emit(emit, stage='fact_checker', status='repair_done')
        
        await _emit(emit, stage='fact_checker', status='done')

        fact_checks = [
            ClaimCheck(
                claim=i.claim,
                status=i.status,
                evidence_source_ids=i.evidence_source_ids,
                notes=i.notes,
            )
            for i in fact_out.items
        ]

        # Persist fact checks + mark complete
        if db and session_id:
            await crud.replace_fact_checks(
                db,
                session_id,
                checks=[
                    {
                        "claim": fc.claim,
                        "status": fc.status,
                        "evidence_source_ids": fc.evidence_source_ids,
                        "notes": fc.notes,
                    }
                    for fc in fact_checks
                ],
            )
            await crud.mark_session_completed(db, session_id)

        await _emit(emit, stage='pipeline', status='done')

        return {
            "request_id": request_id,
            "needs_clarification": False,
            "clarifying_questions": [],
            "subquestions": subquestions,
            "summary_markdown": summarizer_out.answer_markdown,
            "sources": api_sources,
            "fact_checks": fact_checks,
            "debug_steps": debug_steps,
        }

    except Exception as e:
        await _emit(emit, stage='pipeline', status='error', message=str(e))
        if db and session_id:
            await crud.mark_session_failed(db, session_id, error=str(e))
        raise