import asyncio
import json
import uuid
from typing import Any
from fastapi import APIRouter, Depends, Query, Request
from fastapi.encoders import jsonable_encoder
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import crud
from app.db.session import get_db, AsyncSessionLocal
from app.orchestrator import run_research_pipeline
from app.schemas import ResearchRequest, ResearchResponse

router = APIRouter(prefix='/api/research', tags=['research'])

def _sse(event: str, data: Any) -> bytes:
    payload = json.dumps(jsonable_encoder(data), ensure_ascii=False)

    return f'event: {event}\ndata: {payload}\n\n'.encode('utf-8')

@router.post('', response_model=ResearchResponse)
async def research(req: ResearchRequest, db: AsyncSession = Depends(get_db)):
    session = await crud.create_research_session(db, user_query=req.query)
    result = await run_research_pipeline(req.query, max_subquestions=req.max_subquestions, db=db, session_id=session.id, emit=None)

    return ResearchResponse(
        session_id=session.id,
        query=req.query,
        needs_clarification=result['needs_clarification'],
        clarifying_questions=result['clarifying_questions'],
        subquestions=result['subquestions'],
        summary_markdown=result['summary_markdown'],
        sources=result['sources'],
        fact_checks=result['fact_checks'],
        debug_steps=result['debug_steps']
    )

@router.get('/stream')
async def research_stream(request: Request, query: str = Query(min_length=3, max_length=2000), max_subquestions: int | None = Query(default=None, ge=1, le=6)):
    """SSE endpoint. Emits events: session, progress, final, server_error"""

    # Create a session using a short-lived DB session
    async with AsyncSessionLocal() as db:
        session = await crud.create_research_session(db, user_query=query)
        session_id = session.id

    queue: asyncio.Queue[tuple[str, Any]] = asyncio.Queue()

    async def emit(event: str, data: dict):
        await queue.put((event, data))

    async def runner():
        try:
            async with AsyncSessionLocal() as db2:
                result = await run_research_pipeline(query, max_subquestions=max_subquestions, db=db2, session_id=session.id, emit=emit)

            final_payload = ResearchResponse(
                session_id=session_id,
                query=query,
                needs_clarification=result['needs_clarification'],
                clarifying_questions=result['clarifying_questions'],
                subquestions=result['subquestions'],
                summary_markdown=result['summary_markdown'],
                sources=result['sources'],
                fact_checks=result['fact_checks'],
                debug_steps=result['debug_steps']
            )
            await queue.put(('final', final_payload))
        except Exception as e:
            await queue.put(('server put', {'message': str(e)}))

    task = asyncio.create_task(runner())

    async def gen():
        yield _sse('session', {'session_id': str(session_id)})

        try:
            while True:
                if await request.is_disconnected():
                    break

                event, data = await queue.get()
                yield _sse(event, data)

                if event in ('final', 'server_error'):
                    break
        finally:
            task.cancel()

    headers = {
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
    }

    return StreamingResponse(gen(), media_type='text/event-stream', headers=headers)