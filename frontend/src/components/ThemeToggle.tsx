export type ThemeMode = 'light' | 'dark'

function applyTheme(mode: ThemeMode) {
    const root = document.documentElement
    if (mode == 'dark') root.classList.add('dark')
        else root.classList.remove('dark')
}

export function ThemeToggle({
    mode,
    onChange
}: {
    mode: ThemeMode,
    onChange: (m: ThemeMode) => void
}) {
    return (
        <button
            className="text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-grat-800 dark:border-gray-700"    
            onClick={() => {
                const next: ThemeMode = mode === 'dark' ? 'light' : 'dark'
                applyTheme(next)
                localStorage.setItem('theme', next)
                onChange(next)
            }}
            type='button'
            aria-label='Toggle'
        >
            Theme: {mode}
        </button>
    )
}

export function initTheme(): ThemeMode {
    const saved = (localStorage.getItem('theme') as ThemeMode | null) ?? null
    const mode: ThemeMode = saved ?? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    applyTheme(mode)

    return mode
}