import re

_ws_re = re.compile(r'\s+')
_blank_lines_re = re.compile(r'\n{3,}')

def clean_text(s: str) -> str:
    s = s.replace('\x00', ' ')
    s = _ws_re.sub(' ', s).strip()
    return s

_setext_h1_re = re.compile(r'^(?!#)([^\n]+)\n={3,}[ \t]*$', re.MULTILINE)
_setext_h2_re = re.compile(r'^(?!#)([^\n]+)\n-{3,}[ \t]*$', re.MULTILINE)
_underline_only_re = re.compile(r'^[ \t]*={3,}[ \t]*$', re.MULTILINE)
_thematic_break_re = re.compile(r'^[ \t]*([-*_])\1{2,}[ \t]*$', re.MULTILINE)

def clean_markdown(s: str) -> str:
    """Sanitize markdown without collapsing newlines (needed for headings/lists)."""
    s = s.replace('\x00', '')
    s = s.replace('\r\n', '\n').replace('\r', '\n')
    # Prefer ATX headings; drop decorative underlines / rules LLMs often emit.
    s = _setext_h1_re.sub(r'# \1', s)
    s = _setext_h2_re.sub(r'## \1', s)
    s = _underline_only_re.sub('', s)
    s = _thematic_break_re.sub('', s)
    s = _blank_lines_re.sub('\n\n', s)
    return s.strip()

def truncate(s: str, max_chars: int) -> str:
    if len(s) <= max_chars:
        return s
    return s[: max_chars-1].rstrip() + '...'

def preview(s: str | None, max_chars: int = 300) -> str | None:
    if not s:
        return None
    return truncate(clean_text(s), max_chars)