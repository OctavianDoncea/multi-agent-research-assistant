from pydantic import BaseModel, Field
from app.llm import LLMMEssage, llm_router
from app.utils.json_parser import parse_json_lenient
from app.utils.text import clean_text
from app.config import settings

class PlannerOutput(BaseModel):
    needs_clarification: bool = False
    clarifying_questions: list[str] = Field(default_factory=list)
    subquestions: list[str] = Field(default_factory=list)

PLANNER_SYSTEM = """You are a planner agent for a research assistant
Your job: convert the user question into 2-4 focused sub-questions that can be answered by web research.

Return ONLY valid JSON in this exact schema:
{
    "needs_clarification": boolean,
    "clarifying_questions": string[],
    "subquestions": string[]
}

Rules:
- If the query is vague/underspecified (e.g. "tell me about AI"), set needs_clarification=true and provide 2-4 clarifying questions.
- Otherwise needs_clarification=False and provide 2-4 subquestions
- Keep subquestions short and web-searchable
"""

async def run_planner(query: str, max_subquestions: int = 3) -> tuple[PlannerOutput, str]:
    messages = [
        LLMMEssage(role='system', content=PLANNER_SYSTEM),
        LLMMEssage(role='user', content=f'User question:\n{query}\n\nMax subquestions: {max_subquestions}')
    ]
    text, provider = await llm_router.chat(messages, models={'groq': settings.groq_model_planner, 'ollama': settings.ollama_model} , temperature=0.1, max_tokens=500)
    data = parse_json_lenient(text)
    out = PlannerOutput.model_validate(data)

    # Enforce max_subquestions
    out.subquestions = [clean_text(x) for x in out.subquestions if clean_text(x)]
    out.clarifying_questions = [clean_text(x) for x in out.clarifying_questions if clean_text(x)]

    if len(out.subquestions) > max_subquestions:
        out.subquestions = out.subquestions[:max_subquestions]

    return out, provider