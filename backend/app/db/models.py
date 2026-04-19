import uuid 
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Text, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base

def utcnow() -> datetime:
    return datetime.now(timezone.utc)

class ResearchSession(Base):
    __tablename__ = 'research_sessions'

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_query: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default='running')
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    
    agent_steps: Mapped[list['AgentStep']] = relationship(back_populates='session', cascade='all, delete-orphan')
    sources: Mapped[list['Source']] = relationship(back_populates='session', cascade='all, delete-orphan')
    fact_checks: Mapped[list['FactCheck']] = relationship(back_populates='session', cascade='all, delete-orphan')


class AgentStep(Base):
    __tablename__ = 'agent_steps'

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('research_sessions.id', ondelete='CASCADE'), nullable=False)
    agent_name: Mapped[str] = mapped_column(String(64), nullable=False)
    input: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    output: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=False)
    tokens_used: Mapped[Optional[int]] = mapped_column(Integer, nullable=False)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    session: Mapped['ResearchSession'] = relationship(back_populates='agent_steps')


class Source(Base):
    __tablename__ = 'sources'

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('research_sessions.id', ondelete='CASCADE'), nullable=False)
    source_id: Mapped[str] = mapped_column(String(32), nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    snippet: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    content_excerpt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    session: Mapped['ResearchSession'] = relationship(back_populates='sources')


class FactCheck(Base):
    __tablename__ = 'fact_checks'

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('research_sessions.id', ondelete='CASCADE'), nullable=False)
    claim: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    evidence_source_ids: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


    session: Mapped['ResearchSession'] = relationship(back_populates='fact_checks')