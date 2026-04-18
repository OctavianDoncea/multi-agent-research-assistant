from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.schemas import ResearchRequest, ResearchResponse
from app.orchestrator import run_research_pipeline
from app.api.routes.sessions import router as sessions_router
from app.db.session import get_db
from app.db import crud

app = FastAPI(title='Multi-Agent Research Assistant API')
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins or ['*'], allow_credentials=True, allow_methods=['*'], allow_headers=['*'])
app.include_router(sessions_router)

@app.get('/health')
async def health():
    return {'status': 'ok'}

@app.post('/api/research', response_model=ResearchResponse)
async def research(req: ResearchRequest, db: AsyncSession = Depends(get_db)):
    session = await crud.create_research_session(db, user_query=req.query)
    result = await run_research_pipeline(req.query, max_subquestions=req.max_subquestions, db=db, session_id=session.id)
    
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