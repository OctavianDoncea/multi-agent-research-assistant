from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Literal, AsyncIterator
from openai import AsyncOpenAI
from tenacity import RetryError, retry, stop_after_attempt, wait_exponential
from app.config import settings

class LLMError(RuntimeError):
    pass


@dataclass
class LLMMessage:
    role: Literal['system', 'user', 'assistant']
    content: str


class LLMProvider:
    name: str

    async def chat(self, *, model: str, messages: list[LLMMessage], temperature: float = 0.2, max_tokens: int = 1200) -> str:
        raise NotImplementedError

    async def stream_chat(self, *, model: str, messages: list[LLMMessage], temperature: float = 0.2, max_tokens: int = 1200) -> AsyncIterator[LLMMessage]:
        raise NotImplementedError


class OpenAICompatProvider(LLMProvider):
    def __init__(self, *, name: str, base_url: str, api_key: str):
        self.name = name
        self._client = AsyncOpenAI(base_url=base_url, api_key=api_key)

    @retry(wait=wait_exponential(min=0.5, max=6), stop=stop_after_attempt(3))
    async def chat(self, *, model: str, messages: list[LLMMessage], temperature: float=0.2, max_tokens: int = 1200) -> str:
        try:
            resp = await self._client.chat.completions.create(model=model, messages=[m.__dict__ for m in messages], temperature=temperature, max_tokens=max_tokens)
            return resp.choices[0].message.content or ''
        except Exception as e:
            raise LLMError(f'{self.name} chat failed: {e}') from e

    async def stream_chat(self, *, model: str, messages: list[LLMMessage], temperature: float = 0.2, max_tokens: int = 1200) -> AsyncIterator[str]:
        try:
            stream = await self._client.chat.completions.create(model=model, messages=[m.__dict__ for m in messages], temperature=temperature, max_tokens=max_tokens, stream=True)
            async for chunk in stream:
                delta = chunk.choices[0].delta.content if chunk.choices else None
                if delta:
                    yield delta
        except Exception as e:
            raise LLMError(f'{self.name} stream chat failed: {e}') from e


class LLMRouter:
    def __init__(self):
        self.providers: dict[str, LLMProvider] = {}

        if settings.groq_api_key:
            self.providers['groq'] = OpenAICompatProvider(name='groq', base_url='https://api.groq.com/openai/v1', api_key=settings.groq_api_key)

        self.providers['ollama'] = OpenAICompatProvider(name='ollama', base_url=settings.ollama_base_url, api_key=settings.ollama_api_key)

    def _model_for(self, provider_name: str, models: dict[str, str] | None) -> str:
        if models and models.get(provider_name):
            return models[provider_name]
        if provider_name == 'groq':
            return settings.groq_model_default
        if provider_name == 'ollama':
            return settings.ollama_model
        
        return settings.groq_model_default

    async def chat(self, messages: list[LLMMessage], *, models: dict[str, str] | None = None, temperature: float = 0.2, max_tokens: int = 1200) -> tuple[str, str]:
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

            model = self._model_for(name, models)
            try:
                out = await p.chat(model=model, messages=messages, temperature=temperature, max_tokens=max_tokens)
                return out, name
            except Exception as e:
                last_err = e

        raise LLMError(f'No LLM provider succeeded. Last error: {last_err}')

    async def stream_chat(self, messages: list[LLMMessage], *, models: dict[str, str] | None = None, temperature: float = 0.2, max_tokens = 1200, provider_box: dict[str, str] | None = None) -> AsyncIterator[str]:
        order = [settings.llm_primary, settings.llm_fallback]
        last_err: Exception | None = None

        async def _gen() -> AsyncIterator[str]:
            nonlocal last_err
            for name in order:
                p = self.providers.get(name)
                if not p:
                    continue

                model = self._model_for(name, models)
                started = False
                try:
                    async for delta in p.stream.chat(model=model, messages=messages, temperature=temperature, max_tokens=max_tokens):
                        if not started:
                            started = True
                            if provider_box is not None:
                                provider_box['name'] = name
                                provider_box['model'] = model
                        yield delta
                    
                    return
                except Exception as e:
                    last_err = e
                    if started:
                        raise
                    continue
            raise LLMError(f'No LLM provider succeeded in stream mode. Last error: {last_err}') from last_err
        
        return _gen()

llm_router = LLMRouter()