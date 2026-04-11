from __future__ import annotations
from dataclasses import dataclass
from re import L
from typing import Any, Literal
from openai import AsyncOpenAI
from tenacity import retry, stop_after_attempt, wait_exponential
from app.config import settings

class LLMError(RuntimeError):
    pass


@dataclass
class LLMMEssage:
    role: Literal['system', 'user', 'asistent']
    content: str


class LLMProvider:
    name: str

    async def chat(self, messages: list[LLMMEssage], temperature: float = 0.2, max_tokens: int = 1200) -> str:
        raise NotImplementedError


class OpenAICompatProvider(LLMProvider):
    def __init__(self, *, name: str, base_url: str, api_key: str, model: str):
        self.name = name
        self._client = AsyncOpenAI(base_url=base_url, api_key=api_key)
        self.model = model

    @retry(wait=wait_exponential(min=0.5, max=6), stop=stop_after_attempt(3))
    async def chat(self, messages: list[LLMMEssage], temperature: float = 0.2, max_tokens: int = 1200) -> str:
        try:
            resp = await self._client.chat.completion.create(
                model = self.model,
                messages = [m.__dict__ for m in messages],
                temperature = temperature,
                max_tokens = max_tokens
            )
            return resp.choices[0].message.content or ''
        except Exception as e:
            raise LLMError(f'{self.name} chat failed: {e}') from e


class LLMRouter:
    def __init__(self):
        self.providers: dict[str, LLMProvider] = {}

        if settings.groq_api_key:
            self.providers['groq'] = OpenAICompatProvider(name='groq', base_url='https://api.groq.com/openai/v1', api_key=settings.groq_api_key, model=settings.groq_model)

        self.providers['ollama'] = OpenAICompatProvider(name='ollama', base_url=settings.ollama_base_url, api_key=settings.ollama_api_key, model=settings.ollama_model)

        if settings.llm_primary not in self.providers:
            pass

    async def chat(self, messages: list[LLMMEssage], **kwargs: Any) -> tuple[str, str]:
        order = [settings.llm_primary, settings.llm_fallback]
        seen = set()
        last_err: Exception | None = None

        for name in order:
            if name in seen:
                continue
            
            seen.add(name)
            p = self.providers.get(name)

            if not p:
                continue

            try:
                out = await p.chat(messages, **kwargs)
                return out, name
            except Exception as e:
                last_err = e

        raise LLMError(f'No LLm provider succeeded. Last error: {last_err}')

llm_router = LLMRouter()