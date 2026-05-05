// frontend/src/App.tsx

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'

import type { ProgressEvent, ResearchResponse, SessionDetail, SessionListItem, Source } from './types'
import type { StageState } from './components/ProgressSteps'
import { getSession, listSessions, researchStream } from './api'

import { HistorySidebar } from './components/HistorySidebar'
import { MobileHistoryDrawer } from './components/MobileHistoryDrawer'
import { ProgressSteps } from './components/ProgressSteps'
import { MarkdownView } from './components/MarkdownView'
import { SourcesPanel } from './components/SourcesPanel'
import { FactChecksPanel } from './components/FactChecksPanel'
import { SkeletonBlock } from './components/Skeleton'
import { ThemeToggle, initTheme, type ThemeMode } from './components/ThemeToggle'
import { TableOfContents } from './components/TableOfContents'
import { QualityPanel } from './components/QualityPanel'
import { SourceDrawer } from './components/SourceDrawer'

const initialStageState: StageState = {
  planner: 'idle',
  researcher: 'idle',
  summarizer: 'idle',
  fact_checker: 'idle'
}

/** If the API stored a full summarizer JSON blob, show only answer_markdown text. */
function unwrapSummaryMarkdown(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const s = raw.trim()
  if (!s) return null
  if (s.startsWith('{') && s.includes('"answer_markdown"')) {
    try {
      const o = JSON.parse(s) as { answer_markdown?: unknown }
      if (typeof o.answer_markdown === 'string') return o.answer_markdown
    } catch {
      /* ignore */
    }
  }
  return raw
}

function deriveStageStateFromDetail(detail: SessionDetail): StageState {
  const names = detail.steps.map((st) => st.agent_name)
  const hasPlanner = names.some((x) => x.startsWith('planner'))
  const hasResearcher = names.some((x) => x.includes('researcher'))
  const hasSummarizer = names.some((x) => x.startsWith('summarizer'))
  const hasFactChecker = names.some((x) => x.startsWith('fact_checker'))
  const failed = detail.status === 'failed'
  const completed = detail.status === 'completed'

  const planner: StageState['planner'] = hasPlanner ? 'done' : failed ? 'error' : 'idle'

  let researcher: StageState['researcher'] = 'idle'
  if (hasResearcher) researcher = 'done'
  else if (failed && hasPlanner) researcher = 'error'
  else if (completed && hasPlanner && !hasResearcher) researcher = 'skipped'

  let summarizer: StageState['summarizer'] = 'idle'
  if (hasSummarizer) summarizer = 'done'
  else if (failed && hasResearcher && !hasSummarizer) summarizer = 'error'
  else if (completed && hasResearcher && !hasSummarizer) summarizer = 'skipped'

  let fact_checker: StageState['fact_checker'] = 'idle'
  if (hasFactChecker) fact_checker = 'done'
  else if (failed && hasSummarizer && !hasFactChecker) fact_checker = 'error'
  else if (completed && hasSummarizer && !hasFactChecker) fact_checker = 'skipped'

  return { planner, researcher, summarizer, fact_checker }
}

function mapDetailToResearch(detail: SessionDetail): ResearchResponse {
  return {
    session_id: detail.id,
    query: detail.user_query,
    needs_clarification: false,
    clarifying_questions: [],
    subquestions: [],
    summary_markdown: unwrapSummaryMarkdown(detail.summary_markdown ?? undefined),
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

async function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'
  ta.style.left = '-9999px'
  document.body.appendChild(ta)
  ta.focus()
  ta.select()
  document.execCommand('copy')
  ta.remove()
}

function SessionLoader({
  onLoaded,
  onLoadingChange,
  onError
}: {
  onLoaded: (detail: SessionDetail) => void
  onLoadingChange: (loading: boolean) => void
  onError: (message: string) => void
}) {
  const { id } = useParams()

  const onLoadedRef = useRef(onLoaded)
  const onLoadingChangeRef = useRef(onLoadingChange)
  const onErrorRef = useRef(onError)
  onLoadedRef.current = onLoaded
  onLoadingChangeRef.current = onLoadingChange
  onErrorRef.current = onError

  useEffect(() => {
    let alive = true

    async function run() {
      if (!id) return
      onLoadingChangeRef.current(true)
      try {
        const detail = await getSession(id)
        if (!alive) return
        onLoadedRef.current(detail)
      } catch (e) {
        if (!alive) return
        onErrorRef.current(String(e))
      } finally {
        if (!alive) return
        onLoadingChangeRef.current(false)
      }
    }

    run()
    return () => {
      alive = false
    }
  }, [id])

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
  const [routeLoading, setRouteLoading] = useState(false)

  const [error, setError] = useState<string | null>(null)

  const [stageState, setStageState] = useState<StageState>(initialStageState)
  const [progressMsg, setProgressMsg] = useState<string | null>(null)

  const closeStreamRef = useRef<null | (() => void)>(null)

  const [drawerSourceId, setDrawerSourceId] = useState<string | null>(null)
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false)

  const [copyNotice, setCopyNotice] = useState<string | null>(null)

  const highlightSourceId = useMemo(() => {
    const h = location.hash || ''
    const m = h.match(/^#source-(S\d+(?:-\d+)*)$/)
    return m ? m[1] : null
  }, [location.hash])

  const sourcesById = useMemo(() => {
    const m = new Map<string, Source>()
    for (const s of current?.sources ?? []) m.set(s.source_id, s)
    return m
  }, [current?.sources])

  const drawerSource = drawerSourceId ? sourcesById.get(drawerSourceId) ?? null : null

  const refreshHistory = useCallback(async () => {
    const s = await listSessions(50)
    setSessions(s)
  }, [])

  useEffect(() => {
    refreshHistory().catch((e) => setError(String(e)))
  }, [refreshHistory])

  function updateFromProgress(evt: ProgressEvent) {
    const { stage, status } = evt
    setProgressMsg(`${stage}: ${status}`)

    setStageState((prev) => {
      const next = { ...prev }
      if (stage === 'planner') {
        if (status === 'start') next.planner = 'running'
        else if (status === 'done' || status === 'needs_clarification') next.planner = 'done'
      }
      if (stage === 'researcher') {
        if (status === 'start') next.researcher = 'running'
        else if (status === 'done') next.researcher = 'done'
      }
      if (stage === 'summarizer') {
        if (status === 'start') next.summarizer = 'running'
        else if (status === 'done') next.summarizer = 'done'
        else if (status === 'skipped_no_sources') next.summarizer = 'skipped'
        else if (status === 'repair_start') next.summarizer = 'running'
      }
      if (stage === 'fact_checker') {
        if (status === 'start') next.fact_checker = 'running'
        else if (status === 'done') next.fact_checker = 'done'
        else if (status === 'repair_start' || status === 'repair_done') next.fact_checker = 'running'
      }
      if (stage === 'pipeline' && status === 'error') {
        if (next.fact_checker === 'running') next.fact_checker = 'error'
        else if (next.summarizer === 'running') next.summarizer = 'error'
        else if (next.researcher === 'running') next.researcher = 'error'
        else if (next.planner === 'running') next.planner = 'error'
      }
      return next
    })
  }

  async function runStream(q: string) {
    setError(null)
    setLoading(true)
    setCurrent(null)
    setDrawerSourceId(null)
    setStageState(initialStageState)
    setProgressMsg(null)

    if (closeStreamRef.current) closeStreamRef.current()

    closeStreamRef.current = researchStream(q, {
      onSession: (sessionId) => {
        setSelectedSessionId(sessionId)
        navigate(`/sessions/${sessionId}`, { replace: true })
      },
      onProgress: (evt) => updateFromProgress(evt),
      onFinal: async (data) => {
        setCurrent({
          ...data,
          summary_markdown: unwrapSummaryMarkdown(data.summary_markdown ?? undefined)
        })
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

  const sessionMatchesSelection =
    !selectedSessionId || !current?.session_id || current.session_id === selectedSessionId

  const hasResult = useMemo(
    () =>
      sessionMatchesSelection &&
      (!!current?.summary_markdown || (current?.sources?.length ?? 0) > 0),
    [current, sessionMatchesSelection]
  )

  async function handleSelectSession(id: string) {
    // Fill the question immediately from list view (your requirement)
    const item = sessions.find((s) => s.id === id)
    if (item) {
      setQuery(item.user_query)
      setLastRunQuery(item.user_query)
    }

    setSelectedSessionId(id)
    setError(null)
    setDrawerSourceId(null)
    navigate(`/sessions/${id}`)
  }

  function handleSessionLoaded(detail: SessionDetail) {
    setQuery(detail.user_query)
    setLastRunQuery(detail.user_query)
    setSelectedSessionId(detail.id)

    setCurrent(mapDetailToResearch(detail))

    setLoading(false)
    setProgressMsg('loaded from history')
    setStageState(deriveStageStateFromDetail(detail))
  }

  const showReport =
    !!current &&
    !current.needs_clarification &&
    !!current.summary_markdown &&
    sessionMatchesSelection

  return (
    <div className="min-h-screen h-full">
      <MobileHistoryDrawer
        open={mobileHistoryOpen}
        onOpenChange={setMobileHistoryOpen}
        sessions={sessions}
        selectedId={selectedSessionId}
        onSelect={handleSelectSession}
      />

      <SourceDrawer
        open={!!drawerSourceId}
        onOpenChange={(v) => {
          if (!v) setDrawerSourceId(null)
        }}
        source={drawerSource}
      />

      <div className="h-screen flex">
        <aside className="w-80 border-r bg-white dark:bg-gray-950 dark:border-gray-800 hidden md:block">
          <HistorySidebar sessions={sessions} selectedId={selectedSessionId} onSelect={handleSelectSession} />
        </aside>

        <main className="flex-1 overflow-auto">
          <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-4">
            <header className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-xl font-bold">Multi-Agent Research Assistant</h1>
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    Publishable research reports with citations, sources, and fact-checks.
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="md:hidden px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800 dark:border-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    onClick={() => setMobileHistoryOpen(true)}
                  >
                    History
                  </button>

                  <ThemeToggle mode={theme} onChange={setTheme} />
                </div>
              </div>
            </header>

            <section className="border rounded bg-white dark:bg-gray-900 dark:border-gray-800 p-4 space-y-3">
              <div className="flex flex-col lg:flex-row gap-2">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onResearch().catch(() => {})
                  }}
                  placeholder="Ask a research question..."
                  className="flex-1 border rounded px-3 py-2 text-sm bg-white dark:bg-gray-950 dark:border-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  aria-label="Research question"
                />

                <button
                  onClick={() => onResearch()}
                  disabled={loading || routeLoading}
                  className="px-4 py-2 rounded bg-gray-900 text-white text-sm disabled:opacity-50 dark:bg-white dark:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
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
                  className="px-3 py-2 rounded border text-sm bg-white hover:bg-gray-50 disabled:opacity-50 dark:bg-gray-900 dark:hover:bg-gray-800 dark:border-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  Export
                </button>

                <button
                  onClick={() => onRetry()}
                  disabled={!lastRunQuery || loading || routeLoading}
                  className="px-3 py-2 rounded border text-sm bg-white hover:bg-gray-50 disabled:opacity-50 dark:bg-gray-900 dark:hover:bg-gray-800 dark:border-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  Retry
                </button>
              </div>

              <ProgressSteps state={stageState} message={progressMsg} />

              {error ? (
                <div
                  role="alert"
                  className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3"
                >
                  {error}
                </div>
              ) : null}

              {selectedSessionId ? (
                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 flex-wrap">
                  <div>
                    Session: <span className="font-mono">{selectedSessionId}</span>
                  </div>

                  <button
                    type="button"
                    className="px-2 py-1 rounded border bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800 dark:border-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    onClick={async () => {
                      try {
                        const url = window.location.href
                        await copyToClipboard(url)
                        setCopyNotice('Copied link')
                        window.setTimeout(() => setCopyNotice(null), 1500)
                      } catch {
                        setCopyNotice('Copy failed')
                        window.setTimeout(() => setCopyNotice(null), 1500)
                      }
                    }}
                  >
                    Copy link
                  </button>

                  {copyNotice ? (
                    <span className="text-[11px] px-2 py-1 rounded bg-green-50 text-green-800 border border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-900">
                      {copyNotice}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </section>

            {/* Route-side effect: when URL is /sessions/:id, load session and populate report */}
            <Routes>
              <Route
                path="/sessions/:id"
                element={
                  <SessionLoader
                    onLoaded={handleSessionLoaded}
                    onLoadingChange={setRouteLoading}
                    onError={(msg) => setError(msg)}
                  />
                }
              />
              <Route path="/" element={null} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>

            {loading || routeLoading ? (
              <div className="border rounded bg-white dark:bg-gray-900 dark:border-gray-800 p-4">
                <div className="font-semibold mb-2">Loading…</div>
                <SkeletonBlock lines={7} />
              </div>
            ) : !hasResult ? (
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Run a query, or open a shareable session link like <span className="font-mono">/sessions/&lt;id&gt;</span>.
              </div>
            ) : null}

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

            {showReport ? (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
                {/* Main report column */}
                <div className="space-y-4">
                  <section className="border rounded bg-white dark:bg-gray-900 dark:border-gray-800 p-4">
                    <div className="space-y-1">
                      <div className="text-xs text-gray-600 dark:text-gray-300">Question</div>
                      <div className="text-base font-semibold">{current.query}</div>
                    </div>

                    <div className="mt-4">
                      <div className="font-semibold mb-2">Summary</div>
                      <MarkdownView
                        markdown={current.summary_markdown!}
                        getSourceById={(id) => sourcesById.get(id)}
                        onOpenSource={(id) => setDrawerSourceId(id)}
                      />
                    </div>
                  </section>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <section className="border rounded bg-white dark:bg-gray-900 dark:border-gray-800 p-4">
                      <div className="font-semibold mb-2">Sources</div>
                      <SourcesPanel
                        sources={current.sources ?? []}
                        highlightSourcesId={highlightSourceId}
                        onOpenSource={(id) => setDrawerSourceId(id)}
                      />
                    </section>

                    <section className="border rounded bg-white dark:bg-gray-900 dark:border-gray-800 p-4">
                      <div className="font-semibold mb-2">Fact checks</div>
                      <FactChecksPanel checks={current.fact_checks ?? []} />
                    </section>
                  </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-4 lg:sticky lg:top-4 self-start">
                  <TableOfContents markdown={current.summary_markdown!} />
                  <QualityPanel sources={current.sources ?? []} checks={current.fact_checks ?? []} />
                  <div className="border rounded bg-white dark:bg-gray-900 dark:border-gray-800 p-3 text-xs text-gray-600 dark:text-gray-300">
                    Tip: hover citations for a preview, click to open the source drawer.
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  )
}