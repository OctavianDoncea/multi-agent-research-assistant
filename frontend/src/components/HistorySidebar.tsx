import type { SessionListItem } from '../types'

function statusClass(status: string) {
    if (status === 'completed')
        return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-900'
    if (status === 'failed')
        return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-900'
    return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-900'
}

export function HistorySidebar({ sessions, selectedId, onSelect }: { sessions: SessionListItem[], selectedId: string | null, onSelect: (id: string) => void }) {
    return (
        <div className="h-full flex flex-col bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
            <div className="px-4 py-3 border-b bg-white dark:bg-gray-950 dark:border-gray-800">
                <div className="font-semibold">History</div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Recent sessions</div>
            </div>
            <div className="flex-1 overflow-auto">
                {sessions.map((s) => {
                    const active = selectedId === s.id
                    return (
                        <button
                            key={s.id}
                            onClick={() => onSelect(s.id)}
                            className={`w-full text-left px-4 py-3 border-b dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 ${
                                active
                                    ? 'bg-gray-100 dark:bg-gray-800'
                                    : 'bg-white dark:bg-gray-950'
                            }`}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-xs text-gray-600 dark:text-gray-400">
                                    {new Date(s.created_at).toLocaleString()}
                                </span>
                                <span className={`px-2 py-0.5 text-[11px] border rounded ${statusClass(s.status)}`}>
                                    {s.status}
                                </span>
                            </div>
                            <div className="mt-1 text-sm line-clamp-2 text-gray-900 dark:text-gray-100">
                                {s.user_query}
                            </div>
                        </button>
                    )
                })}
                {sessions.length === 0 ? (
                    <div className="p-4 text-sm text-gray-600 dark:text-gray-400">No sessions yet.</div>
                ) : null}
            </div>
        </div>
    )
}
