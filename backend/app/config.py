import os
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import quote_plus

from dotenv import load_dotenv

# Resolve .env from this file's location — not os.getcwd() (breaks Alembic vs uvicorn vs tests).
_backend_dir = Path(__file__).resolve().parent.parent
_repo_root = _backend_dir.parent

load_dotenv(_repo_root / ".env")
load_dotenv(_backend_dir / ".env", override=True)

def _split_csv(s: str) -> list[str]:
    return [x.strip() for x in s.split(',') if x.strip()]

@dataclass(frozen=True)
class Settings:
    # LLM routing
    llm_primary: str = os.getenv('LLM_PRIMARY', 'groq')
    llm_fallback: str = os.getenv('LLM_FALLBACK', 'ollama')

    groq_api_key: str | None = os.getenv('GROQ_API_KEY')
    groq_model_planner: str = os.getenv('GROQ_MODEL_PLANNER', 'openai/gpt-oss-20b')
    groq_model_summarizer: str = os.getenv('GROQ_MODEL_SUMMARIZER', 'llama-3.1-8b-instant')
    groq_model_factchecker: str = os.getenv('GROQ_MODEL_FACTCHECKER', 'openai/gpt-oss-20b')
    groq_model_default: str = os.getenv('GROQ_MODEL', 'llama-3.1-8b')

    ollama_base_url: str = os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434/v1')
    ollama_api_key: str = os.getenv('OLLAMA_API_KEY', 'ollama')
    ollama_model: str = os.getenv('OLLAMA_MODEL', 'llama3.1')

    # Search providers
    search_provider: str = os.getenv('SEARCH_PROVIDER', 'duckduckgo')
    search_provider_fallback: str = os.getenv('SEARCH_FALLBACK_PROVIDER', 'duckduckgo')
    tavily_api_key: str | None = os.getenv('TAVILY_API_KEY')
    searxng_base_url: str | None = os.getenv('SEARXNG_BASE_URL')
    max_subquestions: int = int(os.getenv('MAX_SUBQUESTIONS', '3'))
    max_search_result: int = int(os.getenv('MAX_SEARCH_RESULTS', '6'))
    max_pages_per_subquestion: int = int(os.getenv('MAX_PAGES_PER_SUBQUESTION', '2'))

    # Extraction / prompt budgeting
    max_chars_per_page: int = int(os.getenv('MAX_CHARS_PER_PAGE', '8000'))
    max_total_source_chars: int = int(os.getenv('MAX_TOTAL_SOURCE_CHARS', '24000'))

    # Extraction cache
    enable_extraction_cache: bool = os.getenv('ENABLE_EXTRACTION_CACHE', 'true').lower() in ('1', 'true', 'yes', 'y')
    extract_cache_ttl_hours: int = int(os.getenv('EXTRACT_CACHE_TTL_HOURS', '168'))
    extract_cache_ttl_failure_hours: int = int(os.getenv('EXTRACT_CACHE_TTL_FAILURE_HOURS', '12'))

    # Reranking / chunking
    chunk_size: int = int(os.getenv('CHUNK_SIZE', '900'))
    chunk_overlap: int = int(os.getenv('CHUNK_OVERLAP', '120'))
    top_chunks_per_source: int = int(os.getenv('TOP_CHUNKS_PER_SOURCE', '2'))
    max_sources_for_summary: int = int(os.getenv('MAX_SOURCES_FOR_SUMMARY', '10'))

    cors_origins: list[str] = field(
        default_factory=lambda: _split_csv(
            os.getenv('CORS_ORIGINS', 'http://localhost:5173')
        )
    )

    # Database config
    db_user: str = os.getenv('POSTGRES_USER', 'postgres')
    db_password: str = os.getenv('POSTGRES_PASSWORD')
    db_name: str = os.getenv('POSTGRES_DB', 'multi-agent')
    db_host: str = os.getenv('POSTGRES_HOST', 'localhost')
    db_port: int = int(os.getenv('POSTGRES_PORT', '5432'))
    database_url_override: str | None = os.getenv('DATABASE_URL')
    db_ssl: str = os.getenv('DB_SSL', 'disable')

    @property
    def database_url(self) -> str:
        if self.database_url_override:
            return self.database_url_override
        if not self.db_password:
            raise ValueError(
                "POSTGRES_PASSWORD is not set. Put it in your .env (not committed) "
                "or set DATABASE_URL explicitly."
            )

        user = quote_plus(self.db_user)
        password = quote_plus(self.db_password)
        return (
            f"postgresql+asyncpg://{user}:{password}@{self.db_host}:{self.db_port}/{self.db_name}"
        )

    @property
    def db_connect_args(self) -> dict:
        if self.db_ssl.lower() != 'require':
            return {}
        import ssl

        return {'ssl': ssl.create_default_context()}

settings = Settings()