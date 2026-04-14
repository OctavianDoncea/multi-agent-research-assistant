from pydantic import BaseModel, Field
from app.llm import LLMMEssage, llm_router
from app.utils.json_parser import parse_json_lenient

class SummarizerOutput(BaseModel):
    answer_markdown: str
    key_points: list[str] = Field(default_factory=list)

SUMMARIZER_SYSTEM = f"""You are a summarizer agent. Synthesize the provided sources into a clear, accurate answer.

Return ONLY valid JSON:
{
    "answer_markdown": "string (markdown, include inline citations like [S1], [S2])",
    "key_points": ["..."]
}

Rules:
- Use only the provided sources. If sources conflict or are weak, say so.
- Prefer precise, verifiable statements.
- Add inline citations at the end of the sentence: e.g. "... reduces inflation. [S3]"
- If evidence is insufficient, explicitly say "Insufficient evidence in sources".
"""

def _format_sources_for_prompt(sources: list[tuple[str, str, str | None]]) -> str:
    lines = []

    for sid, url, text in sources:
        if not text:
            continue
        lines.append(f'{sid} ({url}\nEXCEPT:\n{text})')
    
    return '\n---\n'.join(lines)

async def run_summarizer(user_query: str, packed_sources: list[tuple[str, str, str | None]]) -> tuple[SummarizerOutput, str]:
     sources_block = _format_sources_for_prompt(packed_sources)
     messages = [
        LLMMEssage(role='system', content=SUMMARIZER_SYSTEM),
        LLMMEssage(role='user', content=f'User question:\n{user_query}\n\nSOURCES:\n{sources_block}')
     ]
     text, provider = await llm_router.chat(messages, temperature=0.2, max_tokens=1400)
     data = parse_json_lenient(text)

     return SummarizerOutput.model_validate(data), provider