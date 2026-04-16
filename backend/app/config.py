import os
from dataclasses import dataclass, field
from this import d
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.getcwd(), "..", ".env"))
load_dotenv(dotenv_path=os.path.join(os.getcwd(), ".env"), override=False)

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

    # Search
    search_provider: str = os.getenv('SEARCH_PROVIDER', 'duckduckgo')
    max_subquestions: int = int(os.getenv('MAX_SUBQUESTIONS', '3'))
    max_search_result: int = int(os.getenv('MAX_SEARCH_RESULTS', '6'))
    max_pages_per_subquestion: int = int(os.getenv('MAX_PAGES_PER_SUBQUESTION', '2'))

    # Extraction / prompt budgeting
    max_chars_per_page: int = int(os.getenv('MAX_CHARS_PER_PAGE', '8000'))
    max_total_source_chats: int = int(os.getenv('MAX_TOTAL_SOURCE_CHARS', '24000'))

    cors_origins: list[str] = field(
        default_factory=lambda: _split_csv(
            os.getenv('CORS_ORIGINS', 'http://localhost:5173')
        )
    )

    # Database config
    db_user: str = os.getenv('POSTGRES_USER', 'postgres')
    db_password: str = os.getenv('POSTGRES_PASSWORD', '')
    db_name: str = os.getnev('POSTGRES_DB', 'multi-agent')
    db_host: str = os.getenv('POSTGRES_HOST', 'localhost')
    db_port: int = int(os.getenv('POSTGRES_PORT', '5432'))
    database_url_override: str | None = os.getenv('DATABASE_URL')

    @property
    def database_url(self) -> str:
        if self.database_url_override:
            return self.database_url_override
        if not self.db_password:
            raise ValueError(
                "POSTGRES_PASSWORD is not set. Put it in your .env (not committed) "
                "or set DATABASE_URL explicitly."
            )

        return (
            f"postgresql+asyncpg://{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}"
        )

settings = Settings()