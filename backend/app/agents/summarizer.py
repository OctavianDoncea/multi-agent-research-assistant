from pydantic import BaseModel, Field
from app.llm import LLMMEssage, llm_router
from app.utils.json_parser import JSONParseError, parse_json_lenient
from app.config import settings

class SummarizerOutput(BaseModel):
    answer_markdown: str
    key_points: list[str] = Field(default_factory=list)

SUMMARIZER_SYSTEM = """You are a summarizer agent. Synthesize the provided sources into a clear, accurate answer.

Return ONLY valid JSON:
{
    "answer_markdown": "string (markdown, include inline citations like [S1-1], [S2-1])",
    "key_points": ["..."]
}

Rules:
- Use only the provided sources. If sources conflict or are weak, say so.
- Never indent citations IDs. Only cite IDs that appear in the SOURCES block
- Add inline citations using the EXACT source_id shown in the SOURCES block (example: [S1-1])
- If evidence is insufficient, explicitly say "Insufficient evidence in sources".
"""

def _format_sources_for_prompt(sources: list[tuple[str, str, str | None]]) -> str:
    lines = []

    for sid, url, text in sources:
        if not text:
            continue
        lines.append(f'{sid} ({url}\nEXCEPT:\n{text})')
    
    return '\n---\n'.join(lines)

async def run_summarizer(user_query: str, packed_sources: list[tuple[str, str, str | None]], *, allowed_source_ids: list[str] | None = None, repair_instructions: str | None = None) -> tuple[SummarizerOutput, str]:
    sources_block = _format_sources_for_prompt(packed_sources)
    constraint_block = ''

    if allowed_source_ids:
        constraint_block = (
            'IMPORTANT CONSTRAINTS:\n'
            f"- Allowed citation source_ids (use EXACTLY these): {', '.join(allowed_source_ids)}\n"
            '- Every bracket citation must contain only IDs from this list.\n'
        )

    prefix = ''
    if repair_instructions:
        prefix = f'REPAIR TASK:\n{repair_instructions}\n\n'

    messages = [
        LLMMEssage(role='system', content=SUMMARIZER_SYSTEM),
        LLMMEssage(role='user', content=(
            f'{prefix}'
            f'User question:\n{user_query}\n\n'
            f'{constraint_block}\n'
            f'SOURCES:\n{sources_block}'
        ))
    ]
    text, provider = await llm_router.chat(messages, models={'groq': settings.groq_model_summarizer, 'ollama': settings.ollama_model}, temperature=0.2, max_tokens=1400)
    try:
        data = parse_json_lenient(text)
    except JSONParseError:
        return SummarizerOutput(answer_markdown=text.strip(), key_points=[]), provider

    return SummarizerOutput.model_validate(data), provider