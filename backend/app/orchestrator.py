from doctest import debug
from sre_compile import MAXCODE
import time
import uuid
import re
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

    all_sources.sort(key=lambda s: 0 if s.extracted_text else 1)

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
            "clarifying_questions": planner_out.clarifying_questions,
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
            api_sources.append(
                Source(
                    source_id=s.source_id,
                    url=s.url,
                    title=s.title,
                    snippet=s.snippet,
                    extracted_text=s.extracted_text,
                )
            )

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
    allowed_ids = sorted({sid for (sid, _url, text) in packed_sources if text})
    t2 = _now_ms()
    try:
        summarizer_out, sum_provider = await run_summarizer(
            query,
            packed_sources,
            allowed_source_ids=allowed_ids,
        )
    except Exception as e:
        summarizer_out = type("FallbackSummary", (), {"answer_markdown": "Summary unavailable: LLM provider error. Please retry."})()
        sum_provider = "unavailable"
        debug_steps.append(
            AgentStepDebug(
                agent="summarizer(error)",
                input_preview=preview(query),
                output_preview=preview(str(e)),
                duration_ms=_now_ms() - t2,
            )
        )
    debug_steps.append(
        AgentStepDebug(
            agent=f'summarizer({sum_provider})',
            input_preview=preview(f'sources_chars={sum(len(t or '') for _, _, t in packed_sources)}'),
            output_preview=preview(summarizer_out.answer_markdown),
            duration_ms=_now_ms() - t2
        )
    )

    # Qualty guard: citation validation + one repair retry: 
    cited_ids = extract_citation_ids(summarizer_out.answer_markdown or '')
    invalid_citations = sorted([cid for cid in cited_ids if cid not in set(allowed_ids)])

    if (not cited_ids) or invalid_citations:
        t2b = _now_ms()
        repair_msg = (
            "Your previous answer had citation issues.\n"
            f"- Invalid citations used: {invalid_citations}\n"
            f"- Allowed citation IDs are: {allowed_ids}\n\n"
            "Rewrite the answer_markdown to include citations using ONLY allowed IDs (e.g., [S1-1]). "
            "Do not use [S1] or any IDs not in the allowed list. Ensure the main claims are cited."
        )
        try:
            summarizer_out, sum_provider2 = await run_summarizer(
                query,
                packed_sources,
                allowed_source_ids=allowed_ids,
                repair_instructions=repair_msg,
            )
            debug_steps.append(
                AgentStepDebug(
                    agent=f"summarizer_repair({sum_provider2})",
                    input_preview=preview(repair_msg),
                    output_preview=preview(summarizer_out.answer_markdown),
                    duration_ms=_now_ms() - t2b
                )
            )
        except Exception as e:
            debug_steps.append(
                AgentStepDebug(
                    agent="summarizer_repair(error)",
                    input_preview=preview(repair_msg),
                    output_preview=preview(str(e)),
                    duration_ms=_now_ms() - t2b,
                )
            )

    # 4) Fact-checker
    t3 = _now_ms()
    try:
        fact_out, fc_provider = await run_fact_checker(
            summarizer_out.answer_markdown,
            packed_sources,
            allowed_source_ids=allowed_ids,
        )
    except Exception as e:
        fact_out = type("FallbackFacts", (), {"items": []})()
        fc_provider = "unavailable"
        debug_steps.append(
            AgentStepDebug(
                agent="fact_checker(error)",
                input_preview=preview(summarizer_out.answer_markdown),
                output_preview=preview(str(e)),
                duration_ms=_now_ms() - t3,
            )
        )
    debug_steps.append(
        AgentStepDebug(
            agent=f'fact_checker({fc_provider})',
            input_preview=preview(summarizer_out.answer_markdown),
            output_preview=preview(str([x.model_dump() for x in fact_out.items])),
            duration_ms=_now_ms() - t3
        )
    )

    # Quality guard: fact-check evidence IDs validation + one repair entry
    allowed_set = set(allowed_ids)
    invalid_evidence_ids = sorted(
        {
            eid
            for item in fact_out.items
            for eid in (item.evidence_source_ids or [])
            if eid not in allowed_set
        }
    )

    if invalid_evidence_ids:
        t3b = _now_ms()
        repair_msg = (
            "Your previous output used invalid evidence_source_ids.\n"
            f"- Invalid evidence IDs: {invalid_evidence_ids}\n"
            f"- Allowed IDs are: {allowed_ids}\n\n"
            "Recompute the fact-check items. evidence_source_ids must contain ONLY allowed IDs."
        )
        try:
            fact_out, fc_provider2 = await run_fact_checker(
                summarizer_out.answer_markdown,
                packed_sources,
                allowed_source_ids=allowed_ids,
                repair_instructions=repair_msg,
            )
            debug_steps.append(
                AgentStepDebug(
                    agent=f"fact_checker_repair({fc_provider2})",
                    input_preview=preview(repair_msg),
                    output_preview=preview(str([x.model_dump() for x in fact_out.items])),
                    duration_ms=_now_ms() - t3b,
                )
            )
        except Exception as e:
            debug_steps.append(
                AgentStepDebug(
                    agent="fact_checker_repair(error)",
                    input_preview=preview(repair_msg),
                    output_preview=preview(str(e)),
                    duration_ms=_now_ms() - t3b,
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