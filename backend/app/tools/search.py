import asyncio
from dataclasses import dataclass
from typing import List, Optional

from duckduckgo_search import DDGS

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
            out.append(
                SearchResult(
                    url=r.get("href") or r.get("url") or "",
                    title=clean_text(r.get("title") or "") or None,
                    snippet=clean_text(r.get("body") or r.get("snippet") or "") or None,
                )
            )
    # filter empty urls
    return [x for x in out if x.url]


async def web_search(query: str, max_results: int | None = None) -> List[SearchResult]:
    provider = settings.search_provider.lower()

    if provider != "duckduckgo":
        raise ValueError(f"Unsupported SEARCH_PROVIDER={provider} (Phase 2 implements duckduckgo).")
    max_results = max_results or settings.max_search_results
    
    return await asyncio.to_thread(_ddg_search_sync, query, max_results)