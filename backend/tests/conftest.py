import os
import sys
import subprocess
from pathlib import Path
from urllib.parse import quote_plus
import pytest
from sqlalchemy import text
from dotenv import load_dotenv

_backend_dir = Path(__file__).resolve().parents[1]
_repo_root = _backend_dir.parent

load_dotenv(_repo_root / ".env")
load_dotenv(_backend_dir / ".env", override=True)


def _build_database_url() -> str:
    existing = os.getenv('DATABASE_URL')
    if existing:
        return existing
    user = quote_plus(os.getenv('POSTGRES_USER', 'postgres'))
    password = quote_plus(os.getenv('POSTGRES_PASSWORD', 'postgres'))
    host = os.getenv('POSTGRES_HOST', 'localhost')
    port = os.getenv('POSTGRES_PORT', '5432')
    name = os.getenv('POSTGRES_DB', 'multi-agent')
    return f"postgresql+asyncpg://{user}:{password}@{host}:{port}/{name}"


os.environ['DATABASE_URL'] = _build_database_url()


@pytest.fixture(scope='session')
def backend_dir() -> Path:
    return _backend_dir


@pytest.fixture(scope='session')
def apply_migrations(backend_dir: Path):
    """Apply alembic migrations once before tests that need a DB."""
    cmd = [sys.executable, '-m', 'alembic', '-c', 'alembic.ini', 'upgrade', 'head']
    subprocess.run(cmd, cwd=str(backend_dir), check=True)


@pytest.fixture
async def db_clean(apply_migrations):
    """Truncate all tables between tests to keep isolation."""
    from app.db.session import AsyncSessionLocal

    async with AsyncSessionLocal() as s:
        await s.execute(text('TRUNCATE fact_checks, sources, agent_steps, research_sessions RESTART IDENTITY CASCADE;'))
        await s.commit()
    yield
    async with AsyncSessionLocal() as s:
        await s.execute(text('TRUNCATE fact_checks, sources, agent_steps, research_sessions RESTART IDENTITY CASCADE;'))
        await s.commit()


@pytest.fixture
def fastapi_app(db_clean):
    from app.main import app
    return app
