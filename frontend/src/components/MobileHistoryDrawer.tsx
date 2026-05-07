import { X } from 'lucide-react'
import { HistorySidebar } from './HistorySidebar'
import type { SessionListItem } from '../types'
import { Button } from './ui/button'
import { ScrollArea } from './ui/scroll-area'
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from './ui/sheet'

export function MobileHistoryDrawer({
    open,
    onOpenChange,
    sessions,
    selectedId,
    onSelect
}: {
    open: boolean
    onOpenChange: (v: boolean) => void
    sessions: SessionListItem[]
    selectedId: string | null
    onSelect: (id: string) => void
}) {
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="left"
                className="w-[min(100%,22rem)] max-w-full border-r border-border p-0 sm:max-w-sm"
            >
                <div className="border-b border-border bg-gradient-to-br from-primary/[0.08] via-transparent to-transparent px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <SheetTitle className="text-left text-lg font-bold tracking-tight text-foreground">
                                History
                            </SheetTitle>
                            <SheetDescription className="mt-1 text-xs text-muted-foreground">
                                Recent sessions
                            </SheetDescription>
                        </div>
                        <SheetClose asChild>
                            <Button variant="ghost" size="icon" className="shrink-0 rounded-full" aria-label="Close">
                                <X className="h-5 w-5" />
                            </Button>
                        </SheetClose>
                    </div>
                </div>

                <ScrollArea className="h-[calc(100dvh-5.5rem)] px-2 py-2">
                    <HistorySidebar
                        sessions={sessions}
                        selectedId={selectedId}
                        onSelect={(id) => {
                            onSelect(id)
                            onOpenChange(false)
                        }}
                    />
                </ScrollArea>
            </SheetContent>
        </Sheet>
    )
}
