from __future__ import annotations
import uuid
from datetime import datetime, timezone
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import ResearchSession, AgentStep, Source, FactCheck

def utcnow() -> datetime:
    return datetime.now(timezone.utc)

async def create_research_session(db: AsyncSession, *, user_query: str) -> ResearchSession:
    s = ResearchSession(user_query=user_query, status='running')
    db.add(s)
    await db.commit()
    await db.refresh(s)

    return s

async def mark_session_completed(db: AsyncSession, session_id: uuid.UUID):
    await db.execute(update(ResearchSession).where(ResearchSession.id==session_id).values(status='completed', updated_at=utcnow(), error=None))
    await db.commit()

async def mark_session_failed(db: AsyncSession, session_id: uuid.UUID, error: str):
    await db.execute(update(ResearchSession).where(ResearchSession.id==session_id).values(status='failed', updated_at=utcnow(), error=error))
    await db.commit()

async def add_agent_step(db: AsyncSession, *, session_id: uuid.UUID, agent_name: str, input: dict | None, output: dict | None, tokens_used: int | None, duration_ms: int):
    step = AgentStep(session_id=session_id, agent_name=agent_name, input=input, output=output, tokens_used=tokens_used, duration_ms=duration_ms)
    db.add(step)
    await db.commit()

async def replace_sources(db: AsyncSession, session_id: uuid.UUID, sources: list[dict]):
    await db.execute(delete(Source).where(Source.session_id==session_id))
    db.add_all([Source(session_id=session_id, **s) for s in sources])
    await db.commit()

async def replace_fact_checks(db: AsyncSession, session_id: uuid.UUID, checks: list[dict]):
    await db.execute(delete(FactCheck).where(FactCheck.session_id==session_id))
    db.add_all([FactCheck(session_id=session_id, **c) for c in checks])
    await db.commit()

async def get_session(db: AsyncSession, session_id: uuid.UUID) -> ResearchSession | None:
    res = await db.execute(select(ResearchSession).where(ResearchSession.id == session_id))
    return res.scalar_one_or_none()


async def list_sessions(db: AsyncSession, limit: int = 50) -> list[ResearchSession]:
    q = select(ResearchSession).order_by(ResearchSession.created_at.desc()).limit(limit)
    res = await db.execute(q)
    return list(res.scalars().all())

async def get_session_steps(db: AsyncSession, session_id: uuid.UUID) -> list[AgentStep]:
    res = await db.execute(select(AgentStep).where(AgentStep.session_id==session_id).order_by(AgentStep.created_at.asc()))
    return list(res.scalars().all())

async def get_session_sources(db: AsyncSession, session_id: uuid.UUID) -> list[Source]:
    res = await db.execute(select(Source).where(Source.session_id==session_id).order_by(Source.source_id.asc()))
    return list(res.scalars().all())

async def get_session_fact_checks(db: AsyncSession, session_id: uuid.UUID) -> list[FactCheck]:
    res = await db.execute(select(FactCheck).where(FactCheck.session_id==session_id))
    return list(res.scalars().all())