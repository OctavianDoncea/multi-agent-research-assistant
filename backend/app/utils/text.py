import re

_ws_re = re.compile(r'\s+')

def clean_text(s: str) -> str:
    s = s.replace('\x00', ' ')
    s = _ws_re.sub(' ', s).strip()
    return s

def truncate(s: str, max_chars: int) -> str:
    if len(s) <= max_chars:
        return s
    return s[: max_chars-1].rstrip() + '...'

def preview(s: str | None, max_chars: int = 300) -> str | None:
    if not s:
        return None
    return truncate(clean_text(s), max_chars)