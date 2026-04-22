import asyncio
import httpx
import trafilatura
import socket
import ipaddress
from dataclasses import dataclass
from urllib.parse import urlparse, urljoin
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

class SSRFBlocked(ValueError):
    pass

def _is_ip_public(ip: str) -> bool:
    addr = ipaddress.ip_address(ip)
    return addr.is_global

def _host_is_safe(host: str) -> bool:
    host = host.strip().lower()
    if host in ("localhost",):
        return False

    try:
        ipaddress.ip_address(host)
        return _is_ip_public(host)
    except ValueError:
        pass

    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        return False

    ips = {info[4][0] for info in infos if info and info[4]}
    if not ips:
        return False
    return all(_is_ip_public(ip) for ip in ips)

def _validate_url(url: str):
    p = urlparse(url)
    if p.scheme not in ('http', 'https'):
        raise SSRFBlocked(f'Blocked non-http(s) URL scheme: {p.scheme}')
    if not p.hostname:
        raise SSRFBlocked('Blocked URL with no hostname')
    if p.username or p.password:
        raise SSRFBlocked('Blocked URL with userinfo')
    if not _host_is_safe(p.hostname):
        raise SSRFBlocked(f'Blocked unsafe host: {p.hostname}')

async def _get_with_safe_redirects(client: httpx.AsyncClient, url: str, *, timeout_s: float, max_redirects: int= 5) -> httpx.Response:
    current = url

    for _ in range(max_redirects + 1):
        _validate_url(current)
        resp = await client.get(current)

        if resp.status_code in (301, 301, 303, 307, 308):
            loc = resp.headers.get('location')
            if not loc:
                return resp
            current = urljoin(current, loc)
            continue
        return resp
    return resp

async def fetch_and_extract(url: str, timeout_s: float = 15.0) -> ExtractedPage:
    headers = {
        'User-Agent': 'Mozilla/5.0 (compatible; MARA/1.0; +https://example.com/bot)'
    }

    try:
        async with httpx.AsyncClient(follow_redirects=False, timeout=timeout_s, headers=headers) as client:
            resp = await _get_with_safe_redirects(client, url, timeout_s=timeout_s)
            status = resp.status_code

            if status >= 400:
                return ExtractedPage(url=url, status_code=status, title=None, text=None, error=f'HTTP {status}')

            html = resp.text
            extracted = trafilatura.extract(html, include_comments=False, include_tables=False)
            
            if not extracted:
                return ExtractedPage(url=url, status_code=status, title=None, text=None, error='Empty extraction')

            text = truncate(clean_text(extracted), settings.max_chars_per_page)
            return ExtractedPage(url=url, status_code=status, title=None, text=text, error=None)
    except SSRFBlocked as e:
        return ExtractedPage(url=url, status_code=None, title=None, text=None, error=f'SSRF blocked: {e}')
    except Exception as e:
        return ExtractedPage(url=url, status_code=None, title=None, text=None, error=str(e))

async def extract_many(urls: list[str], concurrency: int = 5) -> list[ExtractedPage]:
    sem = asyncio.Semaphore(concurrency)

    async def _wrapped(u: str) -> ExtractedPage:
        async with sem:
            return await fetch_and_extract(u)
    
    return await asyncio.gather(*[_wrapped(u) for u in urls])