import asyncio
import httpx
import trafilatura
from dataclasses import dataclass
from typing import Optional
from app.config import settings
from app.utils.text import clean_text, truncate

@dataclass
class ExtractedPage:
    url: str
    status_code: int | None
    title: Optional[str]
    text: Optional[str]
    error: Optional[str]

async def fetch_and_extract(url: str, timeout_s: float = 15.0) -> ExtractedPage:
    headers = {
        'User-Agent': 'Mozilla/5.0 (compatible; MARA/1.0; +https://example.com)'
    }

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=timeout_s, headers=headers) as client:
            resp = await client.get(url)
            status = resp.status_code

            if status >= 400:
                return ExtractedPage(url=url, status_code=status, title=None, text=None, error=f'HTTP {status}')

            html = resp.text
            extracted = trafilatura.extract(html, include_comments=False, include_tables=False)

            if not extracted:
                return ExtractedPage(url=url, status_code=status, title=None, text=None, error='Empty extraction')

            text = truncate(clean_text(extracted), settings.max_chars_per_page)
            return ExtractedPage(url=url, status_code=status, title=None, text=text, error=None)
    except Exception as e:
        return ExtractedPage(url=url, status_code=None, title=None, text=None, error=str(e))

async def extract_many(urls: list[str], concurrency: int = 5) -> list[ExtractedPage]:
    sem = asyncio.Semaphore(concurrency)

    async def _wrapped(u: str) -> ExtractedPage:
        async with sem:
            return await fetch_and_extract(u)
    
    return await asyncio.gather(*[_wrapped(u) for u in urls])