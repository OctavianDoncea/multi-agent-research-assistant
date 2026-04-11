from pydantic import BaseModel, Field
from typing import Literal

class ResearchRequest(BaseModel):
    query: str = Field(min_length=3, max_length=2000)
    max_subquestions: int | None = Field(default=None, ge=1, le=6)

class Source(BaseModel):
    source_id: str
    url: str
    title: str | None = None
    snippet: str | None = None
    extracted_text: str | None = None

class AgentStepDebug(BaseModel):
    agent: str
    input_preview: str | None = None
    output_preview: str | None = None
    duration_ms: int

class ClaimCheck(BaseModel):
    claim: str
    status: Literal['supported', 'unsupported', 'uncertain']
    evidence_source_ids: list[str] = Field(default_factory=list)
    notes: str | None = None

class ResearchResponse(BaseModel):
    query: str
    needs_clarification: bool = False
    clarifying_questions: list[str] = Field(default_factory=list)
    subquestions: list[str] = Field(default_factory=list)
    summary_markdown: str | None = None
    sources: list[Source] = Field(default_factory=list)
    fact_checks: list[ClaimCheck] = Field(default_factory=list)
    debug_steps: list[AgentStepDebug] = Field(default_factory=list)