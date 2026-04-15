from pydantic import BaseModel, Field
from typing import Literal
from app.llm import LLMMEssage, llm_router
from app.utils.json_parser import JSONParseError, parse_json_lenient
from app.config import settings

class FactCheckItem(BaseModel):
    claim: str
    status: Literal['supported', 'unsupported', 'uncertain']
    evidence_source_ids: list[str] = Field(default_factory=list)
    notes: str | None = None


class FactCheckerOutput(BaseModel):
    items: list[FactCheckItem] = Field(default_factory=list)

FACTCHECK_SYSTEM = """You are a fact-checker agent.

You receive:
1) A drafted answer (markdown) with citations like [S1]
2) The source excerpts keyed by source_id (S1, S2, ...)

Task:
- Extract 4-10 major factual claims from the answer.
- For each claim, decide if it is supported by the provided excerpts.

Return ONLY valid JSON:
{
    "items": [
        {
            "claim": "string",
            "status": "supported|unsupported|uncertain",
            "evidence_source_ids": ["S1-1", "S3-2"],
            "notes": "optional short reasoning"
        }
    ]
}

Rules:
- If the answer makes a claim that is not clearly in the excerpts: status="uncertain" or "unsupported"
- If sources conflict: status="uncertain" and mention conflict
- Prefer conservative labeling
"""

def _format_sources(sources: list[tuple[str, str, str | None]]) -> str:
    blocks = []

    for sid, url, text in sources:
        if not text:
            continue
        blocks.append(f'{sid} ({url})\n{text}')
    
    return '\n\n---\n\n'.join(blocks)

async def run_fact_checker(answer_markdown: str, packed_sources: list[tuple[str, str, str | None]]) -> tuple[FactCheckerOutput, str]:
    messages = [
        LLMMEssage(role='system', content=FACTCHECK_SYSTEM),
        LLMMEssage(role='user', content=f'ANSWER:\n{answer_markdown}\n\nSOURCE EXCERPTS:\n{_format_sources(packed_sources)}')
    ]
    text, provider = await llm_router.chat(messages, models={'groq': settings.groq_model_factchecker, 'ollama': settings.ollama_model}, temperature=0.1, max_tokens=1200)
    try:
        data = parse_json_lenient(text)
    except JSONParseError:
        return FactCheckerOutput(items=[]), provider

    return FactCheckerOutput.model_validate(data), provider