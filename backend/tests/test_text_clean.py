from app.utils.text import clean_markdown, clean_text

def test_clean_text_collapses_whitespace():
    assert clean_text('a\n\nb  c') == 'a b c'

def test_clean_markdown_preserves_structure():
    raw = '## Overview\n\nHello world.\n\n### Details\n- one\n- two\n'
    assert clean_markdown(raw) == '## Overview\n\nHello world.\n\n### Details\n- one\n- two'

def test_clean_markdown_normalizes_newlines_and_blank_runs():
    raw = '## Title\r\n\r\n\r\nPara\r\n'
    assert clean_markdown(raw) == '## Title\n\nPara'

def test_clean_markdown_converts_setext_and_strips_rules():
    raw = (
        'Main Risks\n'
        '==========\n'
        '\n'
        'Intro.\n'
        '\n'
        'Section One\n'
        '-----------\n'
        '\n'
        'Body.\n'
        '\n'
        '---\n'
        '\n'
        '## Already ATX\n'
        '====\n'
        '\n'
        'More.\n'
    )
    assert clean_markdown(raw) == (
        '# Main Risks\n'
        '\n'
        'Intro.\n'
        '\n'
        '## Section One\n'
        '\n'
        'Body.\n'
        '\n'
        '## Already ATX\n'
        '\n'
        'More.'
    )