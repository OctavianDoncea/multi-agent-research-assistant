import type { SessionListItem } from '../types'
import { ScrollArea } from './ui/scroll-area'
import { Badge } from './ui/badge'
import { cn } from '../lib/utils'

function statusVariant(status: string) {
    if (status === 'completed') return 'success'
    if (status === 'failed') return 'danger'
    return 'secondary'
}

function statusClass(status: string) {
    if (status === 'completed')
        return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-900'
    if (status === 'failed')
        return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-900'
    return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-900'
}

export function HistorySidebar({ sessions, selectedId, onSelect }: { sessions: SessionListItem[], selectedId: string | null, onSelect: (id: string) => void }) {
    return (
        <div className='h-full flex flex-col'>
            <div className='px-4 py-4 border-b border-border bg-card'>
                <div className='font-semibold'>History</div>
                <div className='text-xs text-muted-foreground'>Recent sessions</div>
            </div>

            <ScrollArea className='flex-1'>
                <div className='p-2 space-y-2'>
                    {sessions.map((s) => {
                        const active = selectedId === s.id
                        return (
                            <button
                                key={s.id}
                                onClick={() => onSelect(s.id)}
                                aria-current={active ? 'page' : undefined}
                                className={cn(
                                    'w-full text-left rounded-lg border border-border bg-card p-3 transition',
                                    'hover:translate-y-[-1px] hover:shadow-soft',
                                    'focus-visible:outine-none focus-visible:ring-2 focus-visible:ring-ring',
                                    active ? 'ring-2 ring-ring' : ''
                                )}
                            >
                                <div className='flex items-center justify-between gap-2'>
                                    <span className='text-[11px] text-muted-foreground'>
                                        {new Date(s.created_at).toLocaleString()}
                                    </span>
                                    <Badge variant={statusVariant(s.status)}>{s.status}</Badge>
                                </div>
                                <div className='mt-2 text-sm line-clamp-2'>{s.user_query}</div>
                            </button>
                        )
                    })}

                    {sessions.length === 0 ? (
                        <div className='p-4 text-sm text-muted-foreground'>No sessions yet.</div>
                    ) : null}
                </div>
            </ScrollArea>
        </div>
    )
}
