// frontend/src/App.tsx

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ChevronDown, Download, Link2, Menu, RotateCcw, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

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
import { Button } from './components/ui/button'
import { Badge } from './components/ui/badge'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './components/ui/collapsible'
import { Input } from './components/ui/input'

const EXAMPLE_PROMPTS = [
  'What are the main risks of LLM agents in production?',
  'Summarize best practices for REST API versioning.',
  'How does PostgreSQL MVCC work at a high level?'
]

function formatSessionWhen(iso: string | undefined): string | null {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return null
  }
}

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

  const selectedSession = useMemo(
    () => (selectedSessionId ? sessions.find((s) => s.id === selectedSessionId) ?? null : null),
    [sessions, selectedSessionId]
  )

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

      <div className="flex h-screen min-h-0">
        <aside className="hidden w-80 shrink-0 border-r border-border bg-card md:block">
          <HistorySidebar sessions={sessions} selectedId={selectedSessionId} onSelect={handleSelectSession} />
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
          <div className="sticky top-0 z-40 shrink-0 border-b border-border/80 bg-background/90 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-background/75">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent opacity-90" />
            <div className="relative mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Multi-agent</div>
                <h1 className="truncate text-base font-bold tracking-tight text-foreground md:text-lg">
                  Research Assistant
                </h1>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <div className="flex items-center rounded-lg border border-border bg-muted/50 p-0.5 shadow-sm">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!selectedSessionId}
                    className="h-9 gap-1.5 px-3 text-xs font-semibold transition motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-soft"
                    onClick={async () => {
                      try {
                        await copyToClipboard(window.location.href)
                        toast.success('Copied link')
                      } catch {
                        toast.error('Copy failed')
                      }
                    }}
                  >
                    <Link2 className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline">Copy</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!current}
                    className="h-9 gap-1.5 px-3 text-xs font-semibold transition motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-soft"
                    onClick={() => {
                      if (!current) return
                      const md = buildExportMarkdown(current)
                      const safe = (current.query || 'report').slice(0, 60).replace(/[^\w\- ]+/g, '')
                      downloadText(`mara-${safe}.md`, md)
                      toast.success('Exported report')
                    }}
                  >
                    <Download className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline">Export</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!lastRunQuery || loading || routeLoading}
                    className="h-9 gap-1.5 px-3 text-xs font-semibold transition motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-soft"
                    onClick={() => void onRetry()}
                  >
                    <RotateCcw className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline">Retry</span>
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="md:hidden"
                  onClick={() => setMobileHistoryOpen(true)}
                  aria-label="Open history"
                >
                  <Menu className="h-4 w-4" />
                </Button>
                <ThemeToggle mode={theme} onChange={setTheme} />
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-6xl space-y-4 p-4 pb-12 md:space-y-5 md:p-6">
              <p className="animate-in fade-in-0 text-sm text-muted-foreground duration-500">
                Publishable research reports with citations, sources, and fact-checks.
              </p>

              <Card className="animate-in fade-in-0 slide-in-from-bottom-1 border-border/80 shadow-soft transition motion-safe:hover:shadow-md motion-safe:hover:-translate-y-0.5 duration-300">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">New research</CardTitle>
                  <CardDescription>Ask a question — we plan, search, summarize, and fact-check.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void onResearch()
                      }}
                      placeholder="Ask a research question…"
                      className="lg:flex-1"
                      aria-label="Research question"
                    />
                    <Button
                      type="button"
                      className="h-10 shrink-0 px-6 font-bold shadow-soft transition motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-md"
                      onClick={() => void onResearch()}
                      disabled={loading || routeLoading}
                    >
                      {loading ? 'Researching…' : 'Research'}
                    </Button>
                  </div>
                  <ProgressSteps state={stageState} message={progressMsg} />
                </CardContent>
                {selectedSessionId ? (
                  <CardFooter className="flex flex-wrap gap-2 border-t border-border/60 bg-muted/20 text-xs text-muted-foreground">
                    <span className="font-mono text-[11px] text-foreground/80">{selectedSessionId}</span>
                  </CardFooter>
                ) : null}
              </Card>

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

              {error ? (
                <Card
                  role="alert"
                  className="animate-in fade-in-0 border-destructive/50 bg-destructive/5 duration-300"
                >
                  <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
                </Card>
              ) : null}

              {loading || routeLoading ? (
                <Card className="animate-in fade-in-0 duration-300">
                  <CardHeader>
                    <CardTitle>Loading…</CardTitle>
                    <CardDescription>Fetching session and report.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SkeletonBlock lines={7} />
                  </CardContent>
                </Card>
              ) : !hasResult ? (
                <Card className="animate-in fade-in-0 border-dashed border-border duration-500">
                  <CardHeader>
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Sparkles className="h-6 w-6" />
                    </div>
                    <CardTitle className="text-lg">Start a research run</CardTitle>
                    <CardDescription>
                      Run a query below, pick a session from history, or open a shareable link like{' '}
                      <span className="font-mono text-foreground/90">/sessions/&lt;id&gt;</span>.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Try</p>
                    <div className="flex flex-col gap-2">
                      {EXAMPLE_PROMPTS.map((p) => (
                        <Button
                          key={p}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-auto justify-start whitespace-normal py-2 text-left text-xs font-medium transition motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-soft"
                          onClick={() => {
                            setQuery(p)
                            setLastRunQuery(p)
                          }}
                        >
                          {p}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {current?.needs_clarification ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Clarifying questions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc space-y-1 pl-5 text-sm">
                      {current.clarifying_questions.map((q, i) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ) : null}

              {showReport ? (
                <div className="animate-in fade-in-0 grid min-w-0 grid-cols-1 gap-4 duration-500 lg:grid-cols-[1fr_320px] lg:gap-5">
                  <div className="min-w-0 space-y-4">
                    <Card className="overflow-hidden border-border/80 shadow-soft transition motion-safe:hover:shadow-md">
                      <CardHeader className="border-b border-border/60 bg-gradient-to-br from-primary/[0.06] to-transparent pb-4">
                        <div className="flex flex-wrap items-center gap-2">
                          {selectedSession ? (
                            <>
                              <Badge variant="secondary" className="font-semibold capitalize">
                                {selectedSession.status}
                              </Badge>
                              {formatSessionWhen(selectedSession.created_at) ? (
                                <Badge variant="outline" className="font-normal tabular-nums">
                                  {formatSessionWhen(selectedSession.created_at)}
                                </Badge>
                              ) : null}
                            </>
                          ) : (
                            <Badge variant="outline">Session</Badge>
                          )}
                        </div>
                        <CardTitle className="pt-2 text-2xl font-bold leading-tight tracking-tight text-foreground">
                          {current.query}
                        </CardTitle>
                        <CardDescription className="text-base font-medium text-muted-foreground">
                          Research question
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                          Summary
                        </h2>
                        <MarkdownView
                          markdown={current.summary_markdown!}
                          getSourceById={(id) => sourcesById.get(id)}
                          onOpenSource={(id) => setDrawerSourceId(id)}
                        />
                      </CardContent>
                    </Card>

                    <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 md:gap-4">
                      <Collapsible defaultOpen className="group">
                        <Card className="overflow-hidden border-border/80 shadow-soft transition motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-md">
                          <CollapsibleTrigger asChild>
                            <button
                              type="button"
                              className="flex w-full items-center justify-between border-b border-border/60 bg-muted/25 px-5 py-4 text-left transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <span className="text-sm font-bold tracking-tight">Sources</span>
                              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <CardContent className="pt-4">
                              <SourcesPanel
                                sources={current.sources ?? []}
                                highlightSourcesId={highlightSourceId}
                                onOpenSource={(id) => setDrawerSourceId(id)}
                              />
                            </CardContent>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>

                      <Collapsible defaultOpen className="group">
                        <Card className="overflow-hidden border-border/80 shadow-soft transition motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-md">
                          <CollapsibleTrigger asChild>
                            <button
                              type="button"
                              className="flex w-full items-center justify-between border-b border-border/60 bg-muted/25 px-5 py-4 text-left transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <span className="text-sm font-bold tracking-tight">Fact checks</span>
                              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <CardContent className="pt-4">
                              <FactChecksPanel checks={current.fact_checks ?? []} />
                            </CardContent>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>
                    </div>
                  </div>

                  <div className="space-y-4 lg:sticky lg:top-[4.5rem] lg:self-start">
                    <Card className="shadow-soft transition motion-safe:hover:shadow-md">
                      <CardContent className="pt-5">
                        <TableOfContents markdown={current.summary_markdown!} />
                      </CardContent>
                    </Card>
                    <QualityPanel sources={current.sources ?? []} checks={current.fact_checks ?? []} />
                    <Card className="border border-dashed border-border/70 bg-muted/20 shadow-none">
                      <CardContent className="py-4 text-xs text-muted-foreground">
                        Tip: hover citations for a preview, click to open the source drawer.
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}