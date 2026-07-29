import type { SessionListItem } from '../types'
import { ScrollArea } from './ui/scroll-area'
import { Badge } from './ui/badge'
import { Input } from './ui/input'
import { cn } from '../lib/utils'

function statusVariant(status: string) {
    if (status === 'completed') return 'success'
    if (status === 'failed') return 'danger'
    return 'secondary'
}

export function HistorySidebar({
    sessions,
    selectedId,
    onSelect,
    searchQuery,
    onSearchChange,
}: {
    sessions: SessionListItem[]
    selectedId: string | null
    onSelect: (id: string) => void
    searchQuery: string
    onSearchChange: (q: string) => void
}) {
    return (
        <div className='h-full flex flex-col'>
            <div className='px-4 py-4 border-b border-border bg-card space-y-3'>
                <div>
                    <div className='font-semibold'>History</div>
                    <div className='text-xs text-muted-foreground'>Recent sessions</div>
                </div>
                <Input
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder='Search history…'
                    aria-label='Search history'
                    className='h-9'
                />
            </div>

            <ScrollArea className='flex-1'>
                <div className='p-2 space-y-2'>
                    {sessions.map((s) => {
                        const active = selectedId === s.id
                        const label = s.title?.trim() || s.user_query
                        return (
                            <button
                                key={s.id}
                                onClick={() => onSelect(s.id)}
                                aria-current={active ? 'page' : undefined}
                                className={cn(
                                    'w-full text-left rounded-lg border border-border bg-card p-3 transition',
                                    'hover:translate-y-[-1px] hover:shadow-soft',
                                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                    active ? 'ring-2 ring-ring' : ''
                                )}
                            >
                                <div className='flex items-center justify-between gap-2'>
                                    <span className='text-[11px] text-muted-foreground'>
                                        {new Date(s.created_at).toLocaleString()}
                                    </span>
                                    <div className='flex items-center gap-1'>
                                        {s.pinned ? <Badge variant='outline'>Pinned</Badge> : null}
                                        <Badge variant={statusVariant(s.status)}>{s.status}</Badge>
                                    </div>
                                </div>
                                <div className='mt-2 text-sm line-clamp-2'>{label}</div>
                                {(s.tags?.length ?? 0) > 0 ? (
                                    <div className='mt-2 flex flex-wrap gap-1'>
                                        {s.tags!.slice(0, 3).map((t) => (
                                            <Badge key={t} variant='secondary' className='text-[10px] font-normal'>
                                                {t}
                                            </Badge>
                                        ))}
                                    </div>
                                ) : null}
                            </button>
                        )
                    })}

                    {sessions.length === 0 ? (
                        <div className='p-4 text-sm text-muted-foreground'>
                            {searchQuery.trim() ? 'No matching sessions.' : 'No sessions yet.'}
                        </div>
                    ) : null}
                </div>
            </ScrollArea>
        </div>
    )
}
