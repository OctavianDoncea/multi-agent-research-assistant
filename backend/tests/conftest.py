import os
import sys
import subprocess
from pathlib import Path
import pytest
from sqlalchemy import text

os.environ.setdefault('DATABASE_URL', 'postgresql+asyncpg://postgres:postgres@localhost:5432/multi-agent')

@pytest.fixture(scope='session')
def backend_dir() -> Path:
    return Path(__file__).resolve().parents[1]

@pytest.fixture(scope='session', autouse=True)
def apply_migrations(backend_dir: Path):
    """Apply almbic migrations once before tests"""
    cmd = [sys.executable, '-m', 'alembic', '-c', 'alembic.ini', 'upgrade', 'head']
    subprocess.run(cmd, cwd=str(backend_dir), check=True)

@pytest.fixture(autouse=True)
async def db_clean():
    """Truncate all tables between tests to keep isolation"""
    from app.db.session import AsyncSessionLocal

    async with AsyncSessionLocal() as s:
        await s.execute(text('TRUNCATE fact_checks, sources, agent_steps, research_sessions RESTART IDENTITY CASCADE;'))
        await s.commit()
    yield
    async with AsyncSessionLocal() as s:
        await s.execute(text('TRUNCATE fact_checks, sources, agent_steps, research_sessions RESTART IDENTITY CASCADE;'))
        await s.commit()

@pytest.fixture
def fastapi_app():
    from app.main import app
    return app