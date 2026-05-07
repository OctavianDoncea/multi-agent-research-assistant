type StageKey = 'planner' | 'researcher' | 'summarizer' | 'fact_checker'

export type StageState = Record<StageKey, 'idle' | 'running' | 'done' | 'error' | 'skipped'>

function pillClass(state: StageState[StageKey]) {
    const base = 'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-all duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-soft'
    if (state === 'running') return `${base} bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-900`
    if (state === 'done') return `${base} bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-900`
    if (state === 'error') return `${base} bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-900`
    if (state === 'skipped') return `${base} bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-900`
    return `${base} bg-muted text-muted-foreground border-border`
}

export function ProgressSteps({ state, message }: { state: StageState, message?: string | null }) {
    const steps: Array<{ key: StageKey; label: string }> = [
        { key: 'planner', label: 'Planning' },
        { key: 'researcher', label: 'Searching' },
        { key: 'summarizer', label: 'Summarizing' },
        { key: 'fact_checker', label: 'Fact-checking' }
    ]

    return (
        <div className="animate-in fade-in-0 slide-in-from-bottom-1 space-y-2 duration-300">
            <div className="flex flex-wrap gap-2">
                {steps.map((s) => (
                    <span key={s.key} className={pillClass(state[s.key])}>
                        {s.label}: {state[s.key]}
                    </span>
                ))}
            </div>
            {message ? (
                <div className="text-xs text-muted-foreground" role="status" aria-live="polite">
                    {message}
                </div>
            ) : null}
        </div>
    )
}