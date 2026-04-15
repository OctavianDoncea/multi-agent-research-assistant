import json
import re
from typing import Any

_JSON_OBJECT_RE = re.compile(r'\{.*\}', re.DOTALL)
_JSON_ARRAY_RE = re.compile(r'\[.*\]', re.DOTALL)

class JSONParseError(ValueError):
    pass


def _escape_control_chars_in_json_strings(text: str) -> str:
    """Escape raw control chars inside JSON string literals."""
    out: list[str] = []
    in_string = False
    escaped = False

    for ch in text:
        if in_string:
            if escaped:
                out.append(ch)
                escaped = False
                continue

            if ch == "\\":
                out.append(ch)
                escaped = True
                continue

            if ch == '"':
                out.append(ch)
                in_string = False
                continue

            if ch == "\n":
                out.append("\\n")
                continue
            if ch == "\r":
                out.append("\\r")
                continue
            if ch == "\t":
                out.append("\\t")
                continue

            # Escape any remaining ASCII control characters.
            if ord(ch) < 0x20:
                out.append(f"\\u{ord(ch):04x}")
                continue

            out.append(ch)
            continue

        out.append(ch)
        if ch == '"':
            in_string = True

    return "".join(out)


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
            try:
                sanitized = _escape_control_chars_in_json_strings(blob)
                return json.loads(sanitized)
            except Exception as e2:
                raise JSONParseError(f'Failed to parse extracted JSON blob: {e2}') from e2