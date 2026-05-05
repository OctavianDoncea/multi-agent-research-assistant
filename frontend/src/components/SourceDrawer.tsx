import * as Dialog from '@radix-ui/react-dialog'
import clsx from 'clsx'
import type { Source } from '../types'

function hostFromUrl(url: string): string | null {
    try {
        return new URL(url).hostname
    } catch {
        return null
    }
}

export function SourceDrawer({
    open,
    onOpenChange,
    source
}: {
    open: boolean,
    onOpenChange: (v: boolean) => void,
    source: Source | null
}) {
    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className='fixed inset-0 bg-black/40' />
                <Dialog.Content
                    className={clsx(
                        'fixed right-0 top-0 h-full w-full max-w-xl bg-white dark:bg-gray-950',
                        'border-l dark:border-gray-800 shadow-xl',
                        'p-4 overflow-auto focus:outline-none'
                    )}
                >
                    <div className='flex items-start justify-between gap-3'>
                        <div className='min-w-0'>
                            <Dialog.Title className='text-sm font-semibold text-gray-900 dark:text-gray-100'>
                                Source details
                            </Dialog.Title>
                            {source ? (
                                <div className='mt-1 text-xs text-gray-600 dark:text-gray-300'>
                                    <span className='font-mono'>{source.source_id}</span>
                                    {hostFromUrl(source.url) ? (
                                        <>
                                            {' . '}
                                            <span>{hostFromUrl(source.url)}</span>
                                        </>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>

                        <Dialog.Close
                            className='px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800 shrink-0
                            dark:border-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400'
                            aria-label='Close'
                        >
                            Close
                        </Dialog.Close>
                    </div>

                    {!source ? (
                        <div className='mt-4 text-sm text-gray-600 dark:text-gray-300'>
                            No source selected.
                        </div>
                    ) : (
                        <div className='mt-4 space-y-3 min-w-0'>
                            <div className='text-sm font-medium break-words text-gray-900 dark:text-gray-100'>
                                {source.title ?? source.url}
                            </div>
                            <a
                                className='text-xs break-all text-blue-600 dark:text-blue-400 hover:underline'
                                href={source.url}
                                target='_blank'
                                rel='noreferrer'
                            >
                                Open in new tab
                            </a>
                            {source.snippet ? (
                                <div className='text-xs text-gray-700 dark:text-gray-300'>{source.snippet}</div>
                            ) : null}

                            <div className='pt-2 border-t dark:border-gray-800'>
                                <div className='text-xs font-semibold mb-2 text-gray-900 dark:text-gray-100'>
                                    Extracted excerpts
                                </div>
                                {source.extracted_text ? (
                                    <pre
                                        className={clsx(
                                            'whitespace-pre-wrap text-[13px] leading-relaxed rounded p-3 border',
                                            'text-gray-900 dark:text-gray-100',
                                            'bg-gray-50 dark:bg-gray-900',
                                            'border-gray-200 dark:border-gray-700',
                                            'break-words'
                                        )}
                                    >
                                        {source.extracted_text}
                                    </pre>
                                ) : (
                                    <div className='text-xs text-gray-600 dark:text-gray-300'>
                                        No extracted text available for this source.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}
