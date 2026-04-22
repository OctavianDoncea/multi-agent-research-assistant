import uuid
import pytest
import httpx
from app.agents.planner import PlannerOutput
from app.agents.summarizer import SummarizerOutput
from app.agents.fact_checker import FactCheckerOutput, FactCheckItem
from app.agents.researcher import ResearchBundle, ResearchSource

@pytest.mark.asyncio
async def test_research_persists_session_and_history(monkeypatch, fastapi_app):
    import app.orchestrator as orch

    # Mock agent calls inside orchestrator
    async def fake_planner(query: str, max_subquestions: int = 3):
        out = PlannerOutput(needs_clarification=False, clarifying_questions=[], subquestions=['What is X?', 'What causes X?'])
        return out, 'test'

    async def fake_researcher(subquestion: str, source_id_prefix: str):
        sources = [
            ResearchSource(
                source_id=f'{source_id_prefix}1',
                url='https://example.com/a',
                title='Example A',
                snippet='Snippet A',
                extracted_text='This is extracted content about X. It supports a claim.'
            )
        ]
        return ResearchBundle(subquestion=subquestion, sources=sources)

    async def fake_summarizer(user_query: str, packed_sources, *, allowed_source_ids=None, repair_instructions=None):
        sid = (allowed_source_ids or ['S1-1'])[0]
        out = SummarizerOutput(answer_markdown=f'X is a thing. [{sid}]', key_points=['X exists'])

        return out, 'test'

    async def fake_fact_checker(answer_markdown: str, packed_sources, *, allowed_source_ids=None, repair_instructions=None):
        sid = (allowed_source_ids or ['S1-1'])[0]
        out = FactCheckerOutput(
            items=[
                FactCheckItem(
                    claim='X is a thing.',
                    status='supported',
                    evidence_source_ids=[sid],
                    notes='Supported by excerpt.'
                )
            ]
        )

        return out, 'test'

    monkeypatch.setattr(orch, 'run_planner', fake_planner)
    monkeypatch.setattr(orch, 'run_researcher', fake_researcher)
    monkeypatch.setattr(orch, 'run_summarizer', fake_summarizer)
    monkeypatch.setattr(orch, 'run_fact_checker', fake_fact_checker)

    transport = httpx.ASGITransport(app=fastapi_app)
    async with httpx.AsyncClient(transport=transport, base_url='http://test') as client:
        # Create session via research
        resp = await client.post('/api/research', json={'query': 'Explain X'})
        assert resp.status_code == 200
        data = resp.json()
        assert 'session_id' in data and data['session_id']
        session_id = uuid.UUID(data['session_id'])
        assert data['summary_markdown'] is not None
        assert data['sources']
        assert data['fact_checks']

        # List sessions
        resp2 = await client.get('/api/sessions')
        assert resp2.status_code == 200
        sessions = resp2.json()
        assert len(sessions) == 1
        assert sessions[0]['id'] == str(session_id)
        assert sessions[0]['status'] in ('completed', 'running', 'failed')

        # Session detail
        resp3 = await client.get(f'/api/sessions/{session_id}')
        assert resp3.status_code == 200
        detail = resp3.json()

        assert detail['id'] == str(session_id)
        assert detail['user_query'] == 'Explain X'
        assert detail['status'] == 'completed'
        assert detail['summary_markdown'] is not None

        # Steps persisted (planner, researcher, summarizer, fact_checker)
        step_names = [s['agent_name'] for s in detail['steps']]
        assert any(n.startswith('planner(') for n in step_names)
        assert any(n == 'researcher(search+extract)' for n in step_names)
        assert any(n.startswith('summarizer(') for n in step_names)
        assert any(n.startswith('fact_checker(') for n in step_names)

        # Sources persisted
        assert len(detail['sources']) >= 1
        assert detail['sources'][0]['url'].startswith('https://example.com')

        # Fact checks persisted
        assert len(detail['fact_checks']) == 1
        assert detail['fact_checks'][0]['status'] == 'supported'