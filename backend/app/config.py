import os
from dataclasses import dataclass
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
    groq_model: str = os.getenv('GROQ_MODEL', 'llama-3.1-8b')

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

    cors_origins: list[str] = _split_csv(os.getenv('CORS_ORIGINS', 'http://localhost:5173'))

settings = Settings()