from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api.routes.sessions import router as sessions_router
from app.api.routes.research import router as research_router
from app.api.routes.auth import router as auth_router

app = FastAPI(title='Multi-Agent Research Assistant API')

# Credentialed browsers (cookie auth) require explicit origins — never '*'.
_cors_origins = settings.cors_origins or [
    'http://localhost:5173',
    'http://localhost:3000',
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)
app.include_router(auth_router)
app.include_router(research_router)
app.include_router(sessions_router)

@app.get('/health')
async def health():
    return {'status': 'ok'}