from pydantic import BaseModel, Field
from typing import Literal
import uuid
from datetime import datetime

class ResearchRequest(BaseModel):
    session_id: uuid.UUID | None = None
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

class SessionListItem(BaseModel):
    id: uuid.UUID
    user_query: str
    status: str
    created_at: datetime

class SessionStep(BaseModel):
    agent_name: str
    input: dict | None = None
    output: dict | None = None
    tokens_used: int | None = None
    duration_ms: int
    created_at: datetime

class SessionDetail(BaseModel):
    id: uuid.UUID
    user_query: str
    status: str
    error: str | None = None
    created_at: datetime
    steps: list[SessionStep] = Field(default_factory=list)
    sources: list[Source] = Field(default_factory=list)
    fact_checks: list[ClaimCheck] = Field(default_factory=list)
    summary_markdown: str | None = None