from doctest import debug
from sre_compile import MAXCODE
import time
import uuid
from typing import Any
from app.config import settings
from app.schemas import AgentStepDebug, Source, ClaimCheck
from app.utils.text import preview, truncate
from app.utils.tokens import estimate_tokens
from app.agents.planner import run_planner
from app.agents.researcher import run_researcher, ResearchBundle
from app.agents.summarizer import run_summarizer
from app.agents.fact_checker import run_fact_checker

def _now_ms() -> int:
    return int(time.time() * 1000)

def _pack_sources_for_llm(bundles: list[ResearchBundle]) -> list[tuple[str, str, str | None]]:
    packed: list[tuple[str, str, str | None]] = []
    total_chars = 0

    all_sources = []
    for b in bundles:
        for s in b.sources:
            all_sources.append(s)

    all.sources.sort(key=lambda s: 0 if s.extracted_text else 1)

    for s in all_sources:
        if not s.extracted_text:
            continue
        
        remaining = settings.max_total_source_chats - total_chars

        if remaining <= 0:
            break

        clipped = truncate(s.extracted_text, min(len(s.extracted_text), remaining))
        packed.append((s.source_id, s.url, clipped))
        total_chars += len(clipped)

    return packed

async def run_research_pipeline(query: str, max_subquestions: int | None = None) -> dict[str, Any]:
    request_id = str(uuid.uuid4())
    debug_steps: list[AgentStepDebug] = []

    max_subq = max_subquestions or settings.max_subquestions

    # 1) Planner
    t0 = _now_ms()
    planner_out, planner_provider = await run_planner(query, max_subquestions=max_subq)
    debug_steps.append(
        AgentStepDebug(
            agent=f'planner({planner_provider})',
            input_preview=preview(query),
            output_preview=preview(str(planner_out.model_dump())),
            duration_ms=_now_ms() - t0
        )
    )

    if planner_out.needs_clarification:
        return {
            'request_id': request_id,
            'needs_clarification': True,
            "clarifying_questions": planner_out.clarifying_question,
            "subquestions": [],
            "summary_markdown": None,
            "sources": [],
            "fact_checks": [],
            "debug_steps": debug_steps
        }

    subquestions = planner_out.subquestions[:max_subq]

    # 2) Researcher (for each subquestion)
    bundles: list[ResearchBundle] = []
    t1 = _now_ms()
    for i, sq in enumerate(subquestions):
        bundle = await run_researcher(sq, source_id_prefix=f'S{i+1}-')
        bundles.append(bundle)

    debug_steps.append(
        AgentStepDebug(
            agent='researcher(search+extract)',
            input_preview=preview(str(subquestions)),
            output_preview=preview(f'bundles={len(bundles)}'),
            duration_ms=_now_ms() - t1
        )
    )

    api_sources: list[Source] = []
    for b in bundles:
        for s in b.sources:
            api_sources(Source(source_id=s.source_id, url=s.url, title=s.title, snippet=s.snippet, extracted_text=s.extracted_text))

    packed_sources = _pack_sources_for_llm(bundles)
    if not packed_sources:
        return {
            'request_id': request_id,
            'needs_clarification': False,
            'clarifying_questions': [],
            'subquestions': subquestions,
            'summary_markdown': 'No readable source content could be extracted from the top search results. Try a different query or more specific keywords',
            'sources': api_sources,
            'fact_checks': [],
            'debug_steps': debug_steps
        }

    # 3) Summarizer
    t2 = _now_ms()
    summarizer_out, sum_provider = await run_summarizer(query, packed_sources)
    debug_steps.append(
        AgentStepDebug(
            agent=f'summarizer({sum_provider})',
            input_preview=preview(f'sources_chars={sum(len(t or '') for _, _, t in packed_sources)}'),
            output_preview=preview(summarizer_out.answer_markdown),
            duration_ms=_now_ms() - t2
        )
    )

    # 4) Fact-checker
    t3 = _now_ms()
    fact_out, fc_provider = await run_fact_checker(summarizer_out.answer_markdown, packed_sources)
    debug_steps.append(
        AgentStepDebug(
            agent=f'fact_checker({fc_provider})',
            input_preview=preview(summarizer_out.answer_markdown),
            output_preview=preview(str([x.model_dump() for x in fact_out.items])),
            duration_ms = _now_ms - t3
        )
    )

    fact_checks = [ClaimCheck(claim=i.claim, status=i.status, evidence_source_ids=i.evidence_source_ids, notes=i.notes) for i in fact_out.items]

    _ = estimate_tokens(summarizer_out.answer_markdown)

    return {
        'request_id': request_id,
        'needs_clarification': False,
        'clarifying_questions': [],
        'subquestions': subquestions,
        'summary_markdown': summarizer_out.answer_markdown,
        'sources': api_sources,
        'fact_checks': fact_checks,
        'debug_steps': debug_steps
    }