from __future__ import annotations
import json
from typing import Any


def coerce_summary_markdown(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, dict):
        inner = value.get('answer_markdown')
        if isinstance(inner, str):
            return _maybe_unwrap_json_object_string(inner)
        if isinstance(inner, dict):
            deeper = inner.get('answer_markdown')
            return deeper if isinstance(deeper, str) else None
        return None
    if isinstance(value, str):
        return _maybe_unwrap_json_object_string(value.strip()) or None
    return str(value)


def _maybe_unwrap_json_object_string(s: str) -> str:
    if not s.startswith('{') or '"answer_markdown"' not in s:
        return s
    try:
        obj = json.loads(s)
    except json.JSONDecodeError:
        return s
    if not isinstance(obj, dict):
        return s
    am = obj.get('answer_markdown')
    if isinstance(am, str):
        return am
    if isinstance(am, dict) and isinstance(am.get('answer_markdown'), str):
        return am['answer_markdown']
    return s
