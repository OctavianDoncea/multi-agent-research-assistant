import { useEffect, useMemo, useRef, useState } from 'react'
import { Route, Routes, useLocation, useNavigate, useParams, Navigate } from 'react-router-dom'
import type { ProgressEvent, ResearchResponse, SessionDetail, SessionListItem } from './types'
import { getSession, listSessions, researchStream } from './api'
import { HistorySidebar } from './components/HistorySidebar'
import { ProgressSteps, type StageState } from './components/ProgressSteps'
import { MarkdownView } from './components/MarkdownView'
import { SourcesPanel } from './components/SourcesPanel'
import { FactChecksPanel } from './components/FactChecksPanel'
import { SkeletonBlock } from './components/Skeleton'
import { ThemeToggle, initTheme, type ThemeMode } from './components/ThemeToggle'

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

function buildExportMarkdown(current: ResearchResponse): string {
  const lines: string[] = []
  lines.push(`# Research Report`)
  lines.push('')
  lines.push(`**Question:** ${current.query}`)
  lines.push('')
  if (current.summary_markdown) {
    lines.push(`## Summary`)
    lines.push('')
    lines.push(current.summary_markdown)
    lines.push('')
  }
  lines.push(`## Sources`)
  lines.push('')
  for (const s of current.sources) {
    lines.push(`- **${s.source_id}**: ${s.title ?? s.url}`)
    lines.push(`  - ${s.url}`)
    if (s.snippet) lines.push(`  - Snippet: ${s.snippet}`)
  }
  lines.push('')
  lines.push(`## Fact checks`)
  lines.push('')
  for (const c of current.fact_checks) {
    lines.push(`- **${c.status.toUpperCase()}**: ${c.claim}`)
    lines.push(`  - Evidence: ${c.evidence_source_ids.join(', ') || '—'}`)
    if (c.notes) lines.push(`  - Notes: ${c.notes}`)
  }
  lines.push('')
  return lines.join('\n')
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function SessionLoader({
  onLoaded
}: {
  onLoaded: (detail: SessionDetail) => void
}) {
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    async function run() {
      if (!id) return
      setLoading(true)
      setErr(null)
      try {
        const detail = await getSession(id)
        if (!alive) return
        onLoaded(detail)
      } catch (e) {
        if (!alive) return
        setErr(String(e))
      } finally {
        if (!alive) return
        setLoading(false)
      }
    }
    run()
    return () => {
      alive = false
    }
  }, [id, onLoaded])

  if (loading) {
    return (
      <div className="border rounded bg-white dark:bg-gray-900 dark:border-gray-800 p-4">
        <div className="font-semibold mb-2">Loading session…</div>
        <SkeletonBlock lines={6} />
      </div>
    )
  }

  if (err) {
    return (
      <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
        Error: {err}
      </div>
    )
  }

  return null
}

export default function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const [theme, setTheme] = useState<ThemeMode>(() => initTheme())
  const [query, setQuery] = useState('')
  const [lastRunQuery, setLastRunQuery] = useState<string | null>(null)
  const [sessions, setSessions] = useState<SessionListItem[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [current, setCurrent] = useState<ResearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stageState, setStageState] = useState<StageState>(initialStageState)
  const [progressMsg, setProgressMsg] = useState<string | null>(null)
  const closeStreamRef = useRef<null | (() => void)>(null)

  const highlightSourceId = useMemo(() => {
    // hash format: #source-S1-1
    const h = location.hash || ''
    const m = h.match(/^#source-(S\d+(?:-\d+)*)$/)
    return m ? m[1] : null
  }, [location.hash])

  async function refreshHistory() {
    const s = await listSessions(50)
    setSessions(s)
  }

  useEffect(() => {
    refreshHistory().catch((e) => setError(String(e)))
  }, [])

  function updateFromProgress(evt: ProgressEvent) {
    const { stage, status } = evt
    setProgressMsg(`${stage}: ${status}`)

    setStageState((prev) => {
      const next = { ...prev }
      if (stage === 'planner') next.planner = status === 'start' ? 'running' : status === 'done' ? 'done' : next.planner
      if (stage === 'researcher') next.researcher = status === 'start' ? 'running' : status === 'done' ? 'done' : next.researcher
      if (stage === 'summarizer') next.summarizer = status === 'start' ? 'running' : status === 'done' ? 'done' : next.summarizer
      if (stage === 'fact_checker') next.fact_checker = status === 'start' ? 'running' : status === 'done' ? 'done' : next.fact_checker
      return next
    })
  }

  async function runStream(q: string) {
    setError(null)
    setLoading(true)
    setCurrent(null)
    setStageState(initialStageState)
    setProgressMsg(null)

    if (closeStreamRef.current) closeStreamRef.current()

    closeStreamRef.current = researchStream(q, {
      onSession: (sessionId) => {
        setSelectedSessionId(sessionId)
        // shareable URL as soon as session exists
        navigate(`/sessions/${sessionId}`, { replace: true })
      },
      onProgress: (evt) => updateFromProgress(evt),
      onFinal: async (data) => {
        setCurrent(data)
        setLoading(false)
        setProgressMsg('done')
        if (data.session_id) {
          setSelectedSessionId(data.session_id)
          navigate(`/sessions/${data.session_id}`, { replace: true })
        }
        await refreshHistory()
      },
      onServerError: (message) => {
        setError(message)
        setLoading(false)
      },
      onNetworkError: () => {
        setError('Network error (SSE connection failed). Is the backend running?')
        setLoading(false)
      }
    })
  }

  async function onResearch() {
    const q = query.trim()
    if (q.length < 3) return
    setLastRunQuery(q)
    await runStream(q)
  }

  async function onRetry() {
    if (!lastRunQuery) return
    setQuery(lastRunQuery)
    await runStream(lastRunQuery)
  }

  const hasResult = useMemo(
    () => !!current?.summary_markdown || (current?.sources?.length ?? 0) > 0,
    [current]
  )

  async function handleSelectSession(id: string) {
    setSelectedSessionId(id)
    setError(null)
    navigate(`/sessions/${id}`)
  }

  function handleSessionLoaded(detail: SessionDetail) {
    // Populate the search box with the question (your requirement)
    setQuery(detail.user_query)
    setLastRunQuery(detail.user_query)
    setSelectedSessionId(detail.id)

    // Show data in the main view
    setCurrent(mapDetailToResearch(detail))

    // Reset progress display to "done-ish" since this is historical
    setLoading(false)
    setProgressMsg('loaded from history')
    setStageState({
      planner: 'done',
      researcher: 'done',
      summarizer: 'done',
      fact_checker: 'done'
    })
  }

  return (
    <div className="min-h-screen h-full">
      <div className="h-screen flex">
        <aside className="w-80 border-r bg-white dark:bg-gray-950 dark:border-gray-800 hidden md:block">
          <HistorySidebar sessions={sessions} selectedId={selectedSessionId} onSelect={handleSelectSession} />
        </aside>

        <main className="flex-1 overflow-auto">
          <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-4">
            <header className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl font-bold">Multi-Agent Research Assistant</h1>
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    Planner → Web Search/Extraction → Summarizer → Fact-checker (with history)
                  </div>
                </div>
                <ThemeToggle mode={theme} onChange={setTheme} />
              </div>
            </header>

            <section className="border rounded bg-white dark:bg-gray-900 dark:border-gray-800 p-4 space-y-3">
              <div className="flex flex-col md:flex-row gap-2">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onResearch().catch(() => {})
                  }}
                  placeholder="Ask a research question..."
                  className="flex-1 border rounded px-3 py-2 text-sm bg-white dark:bg-gray-950 dark:border-gray-700"
                />
                <button
                  onClick={() => onResearch()}
                  disabled={loading}
                  className="px-4 py-2 rounded bg-gray-900 text-white text-sm disabled:opacity-50 dark:bg-white dark:text-gray-900"
                >
                  {loading ? 'Researching…' : 'Research'}
                </button>

                <button
                  onClick={() => {
                    if (!current) return
                    const md = buildExportMarkdown(current)
                    const safe = (current.query || 'report').slice(0, 60).replace(/[^\w\- ]+/g, '')
                    downloadText(`mara-${safe}.md`, md)
                  }}
                  disabled={!current}
                  className="px-3 py-2 rounded border text-sm bg-white hover:bg-gray-50 disabled:opacity-50 dark:bg-gray-900 dark:hover:bg-gray-800 dark:border-gray-700"
                >
                  Export
                </button>

                <button
                  onClick={() => onRetry()}
                  disabled={!lastRunQuery || loading}
                  className="px-3 py-2 rounded border text-sm bg-white hover:bg-gray-50 disabled:opacity-50 dark:bg-gray-900 dark:hover:bg-gray-800 dark:border-gray-700"
                >
                  Retry
                </button>
              </div>

              <ProgressSteps state={stageState} message={progressMsg} />

              {error ? (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
                  {error}
                </div>
              ) : null}

              {selectedSessionId ? (
                <div className="text-xs text-gray-600 dark:text-gray-300">
                  Session: <span className="font-mono">{selectedSessionId}</span>
                </div>
              ) : null}
            </section>

            {/* Route loader: when on /sessions/:id, fetch session and update state */}
            <Routes>
              <Route
                path="/"
                element={
                  loading ? (
                    <div className="border rounded bg-white dark:bg-gray-900 dark:border-gray-800 p-4">
                      <div className="font-semibold mb-2">Researching…</div>
                      <SkeletonBlock lines={7} />
                    </div>
                  ) : !hasResult ? (
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      Run a query, or select a previous session from history (desktop).
                    </div>
                  ) : null
                }
              />
              <Route path="/sessions/:id" element={<SessionLoader onLoaded={handleSessionLoaded} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>

            {current?.needs_clarification ? (
              <section className="border rounded bg-white dark:bg-gray-900 dark:border-gray-800 p-4">
                <div className="font-semibold">Clarifying questions</div>
                <ul className="list-disc pl-6 mt-2 text-sm">
                  {current.clarifying_questions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {current?.summary_markdown ? (
              <section className="border rounded bg-white dark:bg-gray-900 dark:border-gray-800 p-4">
                <div className="font-semibold mb-2">Summary</div>
                <MarkdownView markdown={current.summary_markdown} />
              </section>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <section className="border rounded bg-white dark:bg-gray-900 dark:border-gray-800 p-4">
                <div className="font-semibold mb-2">Sources</div>
                {loading ? (
                  <SkeletonBlock lines={8} />
                ) : (
                  <SourcesPanel sources={current?.sources ?? []} highlightSourcesId={highlightSourceId} />
                )}
              </section>

              <section className="border rounded bg-white dark:bg-gray-900 dark:border-gray-800 p-4">
                <div className="font-semibold mb-2">Fact checks</div>
                {loading ? <SkeletonBlock lines={8} /> : <FactChecksPanel checks={current?.fact_checks ?? []} />}
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}