import * as Dialog from '@radix-ui/react-dialog'
import { HistorySidebar } from './HistorySidebar'
import type { SessionListItem } from '../types'

export function MobileHistoryDrawer({
    open,
    onOpenChange,
    sessions,
    selectedId,
    onSelect
}: {
    open: boolean,
    onOpenChange: (v: boolean) => void,
    sessions: SessionListItem[],
    selectedId: string | null,
    onSelect: (id: string) => void
}) {
    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className='fixed inset-0 bg-black/40' />
                <Dialog.Content className='fixed left-0 top-0 h-full w-full max-w-sm bg-white dark:bg-gray-950 border-r dark:border-gray-800 shadow-xl focus:outline-none'>
                    <div className='flex items-center justify-between px-4 py-3 border-b dark:border-gray-800'>
                        <Dialog.Title className='text-sm font-semibold'>History</Dialog.Title>
                        <Dialog.Close className='px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800 dark:border-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400'>Close</Dialog.Close>
                    </div>

                    <div className='h-[calc(100%-52px)]'>
                        <HistorySidebar
                            sessions={sessions}
                            selectedId={selectedId}
                            onSelect={(id) => {
                                onSelect(id)
                                onOpenChange(false)
                            }}
                        />
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}