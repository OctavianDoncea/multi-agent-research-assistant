import asyncio
import httpx
from dataclasses import dataclass
from typing import List, Optional
from ddgs import DDGS
from app.config import settings
from app.utils.text import clean_text

@dataclass
class SearchResult:
    url: str
    title: Optional[str] = None
    snippet: Optional[str] = None


def _ddg_search_sync(query: str, max_results: int) -> list[SearchResult]:
    out: list[SearchResult] = []
    with DDGS() as ddgs:
        for r in ddgs.text(query, max_results=max_results):
            out.append(SearchResult(
                url = r.get('href') or r.get('url') or '',
                title = clean_text(r.get('title') or '') or None,
                snippet = clean_text(r.get('body') or r.get('snippet') or '') or None
            ))

    return [x for x in out if x.url]

async def _tavily_search(query: str, max_results: int) -> list[SearchResult]:
    if not settings.tavily_api_key:
        raise ValueError("TAVILY_API_KEY is not set.")
    url = "https://api.tavily.com/search"
    payload = {
        'api_key': settings.tavily_api_key,
        'query': query,
        'max_results': max_results,
        'include_answer': False,
        'include_raw_content': False
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        r = await client.post(url, json=payload)
        r.raise_for_status()
        data = r.json()
    results = []
    for item in data.get('results', []):
        results.append(SearchResult(
            url = item.get('url') or '',
            title = clean_text(item.get('title') or '') or None,
            snippet = clean_text(item.get('content') or '') or None
        ))

    return [x for x in results if x.url]

async def _searxng_search(query: str, max_results: int) -> list[SearchResult]:
    if not settings.searxng_base_url:
        raise ValueError("SEARXNG_BASE_URL is not set.")
    base = settings.searxng_base_url.rstrip('/')
    url = f"{base}/search"
    params = {'q': query, 'format': 'json'}
    async with httpx.AsyncClient(timeout=20.0) as client:
        r = await client.get(url, params=params)
        r.raise_for_status()
        data = r.json()

    results = []
    for item in data.get('results' or [])[:max_results]:
        results.append(SearchResult(
            url = item.get('url') or '',
            title = clean_text(item.get('title') or '') or None,
            snippet = clean_text(item.get('content') or '') or None
        ))

    return [x for x in results if x.url]

async def _search_with_provider(provider: str, query: str, max_results: int) -> list[SearchResult]:
    provider = provider.lower().strip()
    if provider == 'duckduckgo':
        return await asyncio.to_thread(_ddg_search_sync, query, max_results)
    if provider == 'tavily':
        return await _tavily_search(query, max_results)
    if provider == 'searxng':
        return await _searxng_search(query, max_results)
    
    raise ValueError(f"Unsupported search provider: {provider}")

async def web_search(query: str, max_results: int) -> List[SearchResult]:
    primary = settings.search_provider
    fallback = settings.search_provider_fallback

    try:
        return await _search_with_provider(primary, query, max_results)
    except Exception:
        if fallback and fallback != primary:
            return await _search_with_provider(fallback, query, max_results)
        raise