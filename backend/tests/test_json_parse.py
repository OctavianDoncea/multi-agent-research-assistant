import pytest
from app.utils.json_parser import parse_json_lenient, JSONParseError

def test_parse_json_lenient_strict_object():
    assert parse_json_lenient('{"a": 1, "b": "x"}') == {'a': 1, 'b': 'x'}

def test_parse_json_lenient_embedded_object():
    s = 'here is output:\n```json\n{ \"ok\": true, \"n\": 2 }\n```\nthanks'
    assert parse_json_lenient(s) == {'ok': True, 'n': 2}

def test_parse_json_lenient_no_json():
    with pytest.raises(JSONParseError):
        parse_json_lenient('no json here')