import re
from dataclasses import dataclass
from typing import Iterable

_WORD_RE = re.compile(r'[a-zA-Z0-9]+')

_STOPWORDS = {'the','a','an','and','or','to','of','in','on','for','with','as','at','by','from','is','are','was','were',
    'be','been','being','that','this','these','those','it','its','they','their','you','your','we','our','can',
    'may','might','will','would','should','could','about','into','over','under','than','then','also'
}

def tokenize(text: str) -> list[str]:
    toks = [t.lower() for t in _WORD_RE.findall(text)]
    return [t for t in toks if t not in _STOPWORDS and len(t) > 2]

def chunk_text(text: str, chunk_size: int, overlap: int) -> list[int]:
    if chunk_size <= 0:
        return [text]
    text = text.strip()
    if len(text) <= chunk_size:
        return [text]

    chunks = []
    step = max(1, chunk_size - overlap)
    for start in range(0, len(text), step):
        chunk = text[start : start + chunk_size].strip()
        if chunk:
            chunks.append(chunk)
        if start + chunk_size >= len(text):
            break
    
    return chunks

def score_chunk(query_tokens: set[str], chunk: str) -> float:
    c_toks = set(tokenize(chunk))
    if not c_toks:
        return 0.0
    overlap = len(query_tokens.intersection(c_toks))
    density = overlap / max(1, len(c_toks))

    return overlap  +2.0 * density

@dataclass
class RankedExcerpt:
    score: float
    excerpt: str

def best_excerpts_for_text(query: str, text: str, *, chunk_size: int, overlap: int, top_k: int) -> list[RankedExcerpt]:
    query_tokens = set(tokenize(query))
    if not query_tokens:
        head = text[:chunk_size].strip()
        return [RankedExcerpt(score=0.0, excerpt=head)] if head else []

    chunks = chunk_text(text, chunk_size, overlap)
    ranked = [RankedExcerpt(score=score_chunk(query_tokens, chunk), excerpt=chunk) for chunk in chunks]
    ranked.sort(key=lambda x: x.score, reverse=True)
    return ranked[:top_k]