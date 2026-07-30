from pydantic import BaseModel, Field
from app.config import settings
from app.llm import llm_router, LLMMessage
from app.utils.text import clean_markdown

class SummarizerOutput(BaseModel):
    answer_markdown: str
    key_points: list[str] = Field (default_factory=list)


SUMMARIZER_MD_SYSTEM = """You are a summarizer agent. Synthesize the provided sources into a clear, accurate answer.

Output requirements:
- Output ONLY Markdown (no JSON).
- Include inline citations using the EXACT source_id shown in the SOURCES block (example: [S1-1]).
- Never invent citation IDs.
- If evidence is insufficient, explicitly say so.

Writing:
- Use headings and bullet points where helpful.
- Be concise but complete.
"""

def _format_sources_for_prompt(sources: list[tuple[str, str, str | None]]) -> str:
    lines = []
    for sid, url, text in sources:
        if not text:
            continue
        lines.append(f'{sid}: ({url})\nEXCERPT:\n{text}\n')

    return '\n'.join(lines)

async def run_summarizer_markdown(user_query: str, packed_sources: list[str, str, str | None], *, allowed_source_ids: list[str] | None = None, repair_instructions: str | None = None) -> tuple[SummarizerOutput, str]:
    sources_block = _format_sources_for_prompt(packed_sources)
    constraint_block = ''

    if allowed_source_ids:
        constraint_block = (
            'IMPORTANT CONSTRAINTS:\n'
            f'- Allowed citation source_ids (use exactly these): {", ".join(allowed_source_ids)}\n'
            '- Every bracket citation must contain only IDs from this list.\n'
        )
    
    prefix = f'REPAIR TASK:\n{repair_instructions}\n\n' if repair_instructions else ''

    messages = [
        LLMMessage(role='system', content=SUMMARIZER_MD_SYSTEM),
        LLMMessage(role='user', content=f'{prefix}User question:\n{user_query}\n\n{constraint_block}\nSOURCES:\n{sources_block}')
    ]
    text, provider = await llm_router.chat(
        messages,
        models={
            'groq': settings.groq_model_summarizer,
            'ollama': settings.ollama_model
        },
        temperature=0.2,
        max_tokens=1600
    )

    return SummarizerOutput(answer_markdown=clean_markdown(text)), provider

async def run_summarizer_markdown_stream(user_query: str, packed_sources: list[tuple[str, str, str | None]], *, allowed_source_ids: list[str] | None = None, emit_delta=None) -> tuple[SummarizerOutput, str]:
    sources_block = _format_sources_for_prompt(packed_sources)
    constraint_block = ''

    if allowed_source_ids:
        constraint_block = (
            'IMPORTANT CONSTRAINTS:\n'
            f'- Allowed citation source_ids (use exactly these): {", ".join(allowed_source_ids)}\n'
            '- Every bracket citation must contain only IDs from this list.\n'
        )

    messages = [
        LLMMessage(role='system', content=SUMMARIZER_MD_SYSTEM),
        LLMMessage(role='user', content=f'User question:\n{user_query}\n\n{constraint_block}\nSOURCES:\n{sources_block}')
    ]
    provider_box: dict[str, str] = {}
    buf: list[str] = []
    stream = await llm_router.stream_chat(
        messages,
        models={
            'groq': settings.groq_model_summarizer,
            'ollama': settings.ollama_model
        },
        temperature=0.2,
        max_tokens=1600,
        provider_box=provider_box
    )

    async for delta in stream:
        buf.append(delta)
        if emit_delta:
            await emit_delta(delta)

    provider = provider_box.get('name', settings.llm_primary)
    text = clean_markdown(''.join(buf))
    return SummarizerOutput(answer_markdown=text), provider