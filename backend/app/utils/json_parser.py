import json
import re
from typing import Any

_JSON_OBJECT_RE = re.compile(r'\{.*\}', re.DOTALL)
_JSON_ARRAY_RE = re.compile(r'\[.*\]', re.DOTALL)

class JSONParseError(ValueError):
    pass

def _first_json_blob(text: str) -> str | None:
    text = text.strip()
    m = _JSON_OBJECT_RE.search(text)

    if m:
        return m.group(0)
    
    m = _JSON_ARRAY_RE.search(text)
    if m:
        return m.group(0)

    return None

def parse_json_lenient(text: str)-> Any:
    """Tries strict JSON parse; if it fails, extract first {...} or [...]"""
    try:
        return json.loads(text)
    except Exception:
        blob = _first_json_blob(text)
        if not blob:
            raise JSONParseError('No JSON object/array found in model output.')
        try:
            return json.loads(blob)
        except Exception as e:
            raise JSONParseError(f'Failed to parse extracted JSON blob: {e}') from e