from dataclasses import dataclass
from typing import Optional
from app.config import settings
from app.tools.search import web_search, SearchResult
from app.tools.extract import extract_many, ExtractedPage
from app.utils.text import clean_text

@dataclass
class ResearchSource:
    source_id: str
    url: str
    title: Optional[str]
    snippet: Optional[str]
    extracted_text: Optional[str]


@dataclass
class ResearchBundle:
    subquestion: str
    sources: list[ResearchSource]

async def run_researcher(subquestion: str, source_id_prefix: str) -> ResearchBundle:
    results: list[SearchResult] = await web_search(subquestion, max_results=settings.max_search_result)
    urls = []

    for r in results:
        if r.url and r.url not in urls:
            urls.append(r.url)
        if len(urls) >= settings.max_pages_per_subquestion:
            break

    pages: list[ExtractedPage] = await extract_many(urls)
    sources: list[ResearchSource] = []

    for idx, r in enumerate(results[: settings.max_search_result]):
        sid = f'{source_id_prefix}{idx+1}'
        extracted = None

        for p in pages:
            if p.url == r.url and p.text:
                extracted = p.text
                break

        sources.append(ResearchSource(
            source_id=sid,
            url=r.url,
            title=clean_text(r.title or '') or None,
            snippet=clean_text(r.snippet or '') or None,
            extracted_text=extracted
        ))

    return ResearchBundle(subquestion=subquestion, sources=sources)