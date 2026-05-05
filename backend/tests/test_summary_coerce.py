from app.utils.summary_markdown import coerce_summary_markdown


def test_coerce_plain_string():
    assert coerce_summary_markdown('Hello') == 'Hello'


def test_coerce_json_blob_string():
    blob = '{"answer_markdown": "**Hi**", "key_points": ["a"]}'
    assert coerce_summary_markdown(blob) == '**Hi**'


def test_coerce_nested_dict_under_answer_markdown():
    inner = {'answer_markdown': 'Body', 'key_points': ['x']}
    assert coerce_summary_markdown({'answer_markdown': inner, 'key_points': []}) == 'Body'


def test_normalize_factcheck_payload_accepts_claims_key():
    from app.agents.fact_checker import _normalize_factcheck_payload, FactCheckerOutput

    raw = {'claims': [{'claim': 'Earth is round', 'status': 'SUPPORTED', 'evidence_source_ids': ['S1-1']}]}
    out = FactCheckerOutput.model_validate(_normalize_factcheck_payload(raw))
    assert len(out.items) == 1
    assert out.items[0].status == 'supported'
