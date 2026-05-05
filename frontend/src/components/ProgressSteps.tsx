type StageKey = 'planner' | 'researcher' | 'summarizer' | 'fact_checker'

export type StageState = Record<StageKey, 'idle' | 'running' | 'done' | 'error' | 'skipped'>

function pillClass(state: StageState[StageKey]) {
    if (state === 'running') return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-900'
    if (state === 'done') return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-900'
    if (state === 'error') return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-900'
    if (state === 'skipped') return 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-900'
    return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700'
}

export function ProgressSteps({ state, message }: { state: StageState, message?: string | null }) {
    const steps: Array<{key: StageKey, label: string}> = [
        { key: 'planner', label: 'Planning' },
        { key: 'researcher', label: 'Searching' },
        { key: 'summarizer', label: 'Summarizing' },
        { key: 'fact_checker', label: 'Fact-checking' }
    ]

    return (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {steps.map((s) => (
              <span
                key={s.key}
                className={`px-2 py-1 text-xs border rounded ${pillClass(state[s.key])}`}
              >
                {s.label}: {state[s.key]}
              </span>
            ))}
          </div>
          {message ? <div className="text-xs text-gray-600" role='status' aria-live='polite'>{message}</div> : null}
        </div>
      )
}