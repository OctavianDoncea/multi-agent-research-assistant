import { useEffect, useMemo, useRef, useState } from 'react'
import type { ProgressEvent, ResearchResponse, SessionDetail, SessionListItem } from './types'
import { getSession, listSessions, researchStream } from './api'
import { HistorySidebar } from './components/HistorySidebar'
import { ProgressSteps, type StageState } from './components/ProgressSteps'
import { MarkdownView } from './components/MarkdownView'
import { SourcesPanel } from './components/SourcesPanel'
import { FactChecksPanel } from './components/FactChecksPanel'

const initialStageState: StageState = {
  planner: 'idle',
  researcher: 'idle',
  summarizer: 'idle',
  fact_checker: 'idle'
}

function mapDetailToResearch(detail: SessionDetail): ResearchResponse {
  return {
    session_id: detail.id,
    query: detail.user_query,
    needs_clarification: false,
    clarifying_questions: [],
    subquestions: [],
    summary_markdown: detail.summary_markdown ?? null,
    sources: detail.sources,
    fact_checks: detail.fact_checks,
    debug_steps: []
  }
}

export default function App() {
  const [query, setQuery] = useState('')
  const [sessions, setSessions] = useState<SessionListItem[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)

  const [current, setCurrent] = useState<ResearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [stageState, setStageState] = useState<StageState>(initialStageState)
  const [progressMsg, setProgressMsg] = useState<string | null>(null)

  const closeStreamRef = useRef<null | (() => void)>(null)

  async function refreshHistory() {
    const s = await listSessions(50)
    setSessions(s)
  }

  useEffect(() => {
    refreshHistory().catch((e) => setError(String(e)))
  }, [])

  async function selectSession(id: string) {
    setSelectedSessionId(id)
    setError(null)
    setLoading(true)
    try {
      const detail = await getSession(id)
      setCurrent(mapDetailToResearch(detail))
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  function updateFromProgress(evt: ProgressEvent) {
    const { stage, status } = evt
    setProgressMsg(`${stage}: ${status}`)

    // map stage → UI state
    setStageState((prev) => {
      const next = { ...prev }
      if (stage === 'planner') next.planner = status === 'start' ? 'running' : status === 'done' ? 'done' : next.planner
      if (stage === 'researcher') next.researcher = status === 'start' ? 'running' : status === 'done' ? 'done' : next.researcher
      if (stage === 'summarizer') next.summarizer = status === 'start' ? 'running' : status === 'done' ? 'done' : next.summarizer
      if (stage === 'fact_checker') next.fact_checker = status === 'start' ? 'running' : status === 'done' ? 'done' : next.fact_checker
      if (stage === 'pipeline' && status === 'error') {
        // mark current running stage as error-ish
        // (keep simple)
      }
      return next
    })
  }

  async function run() {
    const q = query.trim()
    if (q.length < 3) return

    setError(null)
    setLoading(true)
    setCurrent(null)
    setSelectedSessionId(null)
    setStageState(initialStageState)
    setProgressMsg(null)

    // close existing stream if any
    if (closeStreamRef.current) closeStreamRef.current()

    closeStreamRef.current = researchStream(q, {
      onSession: (sessionId) => {
        setSelectedSessionId(sessionId)
      },
      onProgress: (evt) => updateFromProgress(evt),
      onFinal: async (data) => {
        setCurrent(data)
        setLoading(false)
        setProgressMsg('done')
        // refresh history so new session appears
        await refreshHistory()
      },
      onServerError: (message) => {
        setError(message)
        setLoading(false)
        setStageState((s) => ({ ...s }))
      },
      onNetworkError: () => {
        setError('Network error (SSE connection failed). Is the backend running?')
        setLoading(false)
      }
    })
  }

  const hasResult = useMemo(() => !!current?.summary_markdown || (current?.sources?.length ?? 0) > 0, [current])

  return (
    <div className="min-h-screen">
      <div className="h-screen flex">
        <aside className="w-80 border-r bg-white hidden md:block">
          <HistorySidebar sessions={sessions} selectedId={selectedSessionId} onSelect={selectSession} />
        </aside>

        <main className="flex-1 overflow-auto">
          <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-4">
            <header className="space-y-1">
              <h1 className="text-xl font-bold">Multi-Agent Research Assistant</h1>
              <div className="text-sm text-gray-600">
                Planner → Web Search/Extraction → Summarizer → Fact-checker (with history)
              </div>
            </header>

            <section className="border rounded bg-white p-4 space-y-3">
              <div className="flex flex-col md:flex-row gap-2">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') run().catch(() => {})
                  }}
                  placeholder="Ask a research question..."
                  className="flex-1 border rounded px-3 py-2 text-sm"
                />
                <button
                  onClick={() => run()}
                  disabled={loading}
                  className="px-4 py-2 rounded bg-gray-900 text-white text-sm disabled:opacity-50"
                >
                  {loading ? 'Researching…' : 'Research'}
                </button>
              </div>

              <ProgressSteps state={stageState} message={progressMsg} />

              {error ? (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
                  {error}
                </div>
              ) : null}

              {selectedSessionId ? (
                <div className="text-xs text-gray-600">
                  Session: <span className="font-mono">{selectedSessionId}</span>
                </div>
              ) : null}
            </section>

            {!hasResult ? (
              <div className="text-sm text-gray-600">
                Run a query, or select a previous session from history (desktop).
              </div>
            ) : null}

            {current?.needs_clarification ? (
              <section className="border rounded bg-white p-4">
                <div className="font-semibold">Clarifying questions</div>
                <ul className="list-disc pl-6 mt-2 text-sm">
                  {current.clarifying_questions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {current?.summary_markdown ? (
              <section className="border rounded bg-white p-4">
                <div className="font-semibold mb-2">Summary</div>
                <MarkdownView markdown={current.summary_markdown} />
              </section>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <section className="border rounded bg-white p-4">
                <div className="font-semibold mb-2">Sources</div>
                <SourcesPanel sources={current?.sources ?? []} />
              </section>

              <section className="border rounded bg-white p-4">
                <div className="font-semibold mb-2">Fact checks</div>
                <FactChecksPanel checks={current?.fact_checks ?? []} />
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}