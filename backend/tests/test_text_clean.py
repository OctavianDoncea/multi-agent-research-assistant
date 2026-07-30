from app.utils.text import clean_markdown, clean_text

def test_clean_text_collapses_whitespace():
    assert clean_text('a\n\nb  c') == 'a b c'

def test_clean_markdown_preserves_structure():
    raw = '## Overview\n\nHello world.\n\n### Details\n- one\n- two\n'
    assert clean_markdown(raw) == '## Overview\n\nHello world.\n\n### Details\n- one\n- two'

def test_clean_markdown_normalizes_newlines_and_blank_runs():
    raw = '## Title\r\n\r\n\r\nPara\r\n'
    assert clean_markdown(raw) == '## Title\n\nPara'