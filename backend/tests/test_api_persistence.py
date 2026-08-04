import uuid
import pytest
import httpx
from app.agents.planner import PlannerOutput
from app.agents.summarizer import SummarizerOutput
from app.agents.fact_checker import FactCheckerOutput, FactCheckItem
from app.agents.researcher import ResearchBundle, ResearchSource

async def _register(client: httpx.AsyncClient, email: str, password: str = 'password123'):
    resp = await client.post('/api/auth/register', json={'email': email, 'password': password})
    assert resp.status_code == 200, resp.text
    return resp.json()

def _mock_pipeline(monkeypatch):
    import app.orchestrator as orch

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
    monkeypatch.setattr(orch, 'run_summarizer_markdown', fake_summarizer)
    monkeypatch.setattr(orch, 'run_fact_checker', fake_fact_checker)

@pytest.mark.asyncio
async def test_auth_register_login_me_logout(fastapi_app):
    transport = httpx.ASGITransport(app=fastapi_app)
    async with httpx.AsyncClient(transport=transport, base_url='http://test') as client:
        email = f'user-{uuid.uuid4().hex[:8]}@example.com'
        reg = await client.post('/api/auth/register', json={'email': email, 'password': 'password123'})
        assert reg.status_code == 200
        assert reg.json()['email'] == email
        assert reg.json().get('access_token')
        assert 'session_token' in reg.cookies

        me = await client.get('/api/auth/me')
        assert me.status_code == 200
        assert me.json()['email'] == email

        out = await client.post('/api/auth/logout')
        assert out.status_code == 200

        me2 = await client.get('/api/auth/me')
        assert me2.status_code == 401

        bad = await client.post('/api/auth/login', json={'email': email, 'password': 'wrong-password'})
        assert bad.status_code == 401

        ok = await client.post('/api/auth/login', json={'email': email, 'password': 'password123'})
        assert ok.status_code == 200
        token = ok.json()['access_token']

        # Bearer works without cookies (cross-origin / blocked-cookie case)
        client.cookies.clear()
        me_bearer = await client.get('/api/auth/me', headers={'Authorization': f'Bearer {token}'})
        assert me_bearer.status_code == 200
        assert me_bearer.json()['email'] == email

@pytest.mark.asyncio
async def test_research_requires_auth(fastapi_app):
    transport = httpx.ASGITransport(app=fastapi_app)
    async with httpx.AsyncClient(transport=transport, base_url='http://test') as client:
        resp = await client.post('/api/research', json={'query': 'Explain X'})
        assert resp.status_code == 401
        resp2 = await client.get('/api/sessions')
        assert resp2.status_code == 401

@pytest.mark.asyncio
async def test_research_persists_session_and_history(monkeypatch, fastapi_app):
    _mock_pipeline(monkeypatch)

    transport = httpx.ASGITransport(app=fastapi_app)
    async with httpx.AsyncClient(transport=transport, base_url='http://test') as client:
        await _register(client, f'owner-{uuid.uuid4().hex[:8]}@example.com')

        resp = await client.post('/api/research', json={'query': 'Explain X'})
        assert resp.status_code == 200
        data = resp.json()
        assert 'session_id' in data and data['session_id']
        session_id = uuid.UUID(data['session_id'])
        assert data['summary_markdown'] is not None
        assert data['sources']
        assert data['fact_checks']

        resp2 = await client.get('/api/sessions')
        assert resp2.status_code == 200
        sessions = resp2.json()
        assert len(sessions) == 1
        assert sessions[0]['id'] == str(session_id)
        assert sessions[0]['is_public'] is False
        assert sessions[0]['status'] in ('completed', 'running', 'failed')

        resp3 = await client.get(f'/api/sessions/{session_id}')
        assert resp3.status_code == 200
        detail = resp3.json()

        assert detail['id'] == str(session_id)
        assert detail['user_query'] == 'Explain X'
        assert detail['status'] == 'completed'
        assert detail['is_owner'] is True
        assert detail['is_public'] is False
        assert detail['summary_markdown'] is not None

        step_names = [s['agent_name'] for s in detail['steps']]
        assert any(n.startswith('planner(') for n in step_names)
        assert any(n == 'researcher(search+extract)' for n in step_names)
        assert any(n.startswith('summarizer(') for n in step_names)
        assert any(n.startswith('fact_checker(') for n in step_names)

        assert len(detail['sources']) >= 1
        assert detail['sources'][0]['url'].startswith('https://example.com')

        assert len(detail['fact_checks']) == 1
        assert detail['fact_checks'][0]['status'] == 'supported'

@pytest.mark.asyncio
async def test_session_private_vs_public_share(monkeypatch, fastapi_app):
    _mock_pipeline(monkeypatch)

    transport = httpx.ASGITransport(app=fastapi_app)
    async with httpx.AsyncClient(transport=transport, base_url='http://test') as owner:
        await _register(owner, f'owner-{uuid.uuid4().hex[:8]}@example.com')
        created = await owner.post('/api/research', json={'query': 'Explain privacy'})
        session_id = created.json()['session_id']

        # Anonymous cannot see private session
        async with httpx.AsyncClient(transport=transport, base_url='http://test') as anon:
            hidden = await anon.get(f'/api/sessions/{session_id}')
            assert hidden.status_code == 404

        # Owner makes it public
        patched = await owner.patch(f'/api/sessions/{session_id}', json={'is_public': True})
        assert patched.status_code == 200
        assert patched.json()['is_public'] is True
        assert patched.json()['is_owner'] is True

        async with httpx.AsyncClient(transport=transport, base_url='http://test') as anon:
            public = await anon.get(f'/api/sessions/{session_id}')
            assert public.status_code == 200
            assert public.json()['is_public'] is True
            assert public.json()['is_owner'] is False

        # Other user cannot list owner's sessions or patch
        async with httpx.AsyncClient(transport=transport, base_url='http://test') as other:
            await _register(other, f'other-{uuid.uuid4().hex[:8]}@example.com')
            listed = await other.get('/api/sessions')
            assert listed.status_code == 200
            assert listed.json() == []
            denied = await other.patch(f'/api/sessions/{session_id}', json={'title': 'hacked'})
            assert denied.status_code == 404