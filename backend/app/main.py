from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.schemas import ResearchRequest, ResearchResponse
from app.orchestrator import run_research_pipeline
from app.api.routes.sessions import router as sessions_router

app = FastAPI(title='Multi-Agent Research Assistant API')
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins or ['*'], allow_credentials=True, allow_methods=['*'], allow_headers=['*'])
app.include_router(sessions_router)

@app.get('/health')
async def health():
    return {'status': 'ok'}

@app.post('/api/research', response_model=ResearchResponse)
async def research(req: ResearchRequest):
    result = await run_research_pipeline(req.query, max_subquestions=req.max_subquestions)
    return ResearchResponse(
        query=req.query,
        needs_clarification=result['needs_clarification'],
        clarifying_questions=result['clarifying_questions'],
        subquestions=result['subquestions'],
        summary_markdown=result['summary_markdown'],
        sources=result['sources'],
        fact_checks=result['fact_checks'],
        debug_steps=result['debug_steps']
    )