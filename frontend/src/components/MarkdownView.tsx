import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import GithubSlugger from 'github-slugger'
import * as Popover from '@radix-ui/react-popover'
import type { Source } from '../types'

function linkifyCitations(md: string): string {
    const blockRe = /\[(\s*S\d+(?:-\d+)*\s*(?:,\s*S\d+(?:-\d+)*)*\s*)\]/g

    return md.replace(blockRe, (_match, inside: string) => {
        const ids = inside
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        if (ids.length === 0) return _match
        const links = ids.map((id) => `[${id}](#source-${id})`).join(', ')
        return `$({links})` 
    })
}

function hostFromUrl(url: string): string | null {
    try {
        return new URL(url).hostname
    } catch {
        return null
    }
}

function excerpt(text?: string | null, max = 220): string | null {
    if (!text) return null
    const s = text.replace(/\s+/g, '').trim()
    if (s.length <= max) return s
    return s.slice(0, max-1) + '...'
}

export function MarkdownView({
    markdown,
    getSourceById,
    onOpenSource
}: {
    markdown: string,
    getSourceById: (id: string) => Source | undefined,
    onOpenSource: (id: string) => void
}) {
    const processed = linkifyCitations(markdown)
    const slugger = new GithubSlugger()

    return (
        <div className='prose prose-sm max-w-none dark:peose-invert'>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    h1: ({ children }) => {
                        const text = String(children)
                        const id = `h-${slugger.slug(text)}`
                        return <h1 id={id}>{children}</h1>
                    },
                    h2: ({ children }) => {
                        const text = String(children)
                        const id = `h-${slugger.slug(text)}`
                        return <h2 id={id}>{children}</h2>
                    },
                    h3: ({ children }) => {
                        const text = String(children)
                        const id = `h-${slugger.slug(text)}`
                        return <h3 id={id}>{children}</h3>
                    },
                    h4: ({ children }) => {
                        const text = String(children)
                        const id = `h-${slugger.slug(text)}`
                        return <h4 id={id}>{children}</h4>
                    },
                    a: ({ href, children, ...props }) => {
                        const isInternalCitation = typeof href === 'string' && href.startsWith('#source-')
                        if (!isInternalCitation) {
                            return (
                                <a
                                    href={href}
                                    {...props}
                                    target='_blank'
                                    rel='noreferrer'
                                    className='focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded'
                                >
                                    {children}
                                </a>
                            )
                        }

                        const sid = href!.replace('#source-', '')
                        const source = getSourceById(sid)

                        return (
                            <Popover.Root>
                                <Popover.Trigger asChild>
                                    <a
                                        href={href}
                                        {...props}
                                        className='font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded'
                                        onClick={() => {
                                            requestAnimationFrame(() => {
                                                const el = document.getElementById(`source-${sid}`)
                                                el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                                            })
                                            onOpenSource(sid)
                                        }}
                                    >
                                        {children}
                                    </a>
                                </Popover.Trigger>

                                <Popover.Portal>
                                    <Popover.Content
                                        side='top'
                                        align='center'
                                        className='z-50 w-80 rounded border bg-white dark:bg-gray-950 dark:border-gray-800 shadow-lg p-3'
                                    >
                                        <div className='text-xs font-semibold mb-1'>Evidence preview</div>
                                        {!source ? (
                                            <div className='text-xs text-gray-600 dark:text-gray-300'>
                                                Unknown source: <span className='font-mono'>{sid}</span>
                                            </div>
                                        ) : (
                                            <div className='space-y-2'>
                                                <div className='text-xs text-gray-700 dar:text-gray-200'>
                                                    <span className='font-mono'>{source.source_id}</span>
                                                    {hostFromUrl(source.url) ? (
                                                        <span className='text-gray-500 dark:text-gray-400'> . </span>
                                                    ) : null}
                                                </div>
                                                <div className='text-xs font-medium'>
                                                    {source.title ?? source.url}
                                                </div>
                                                {excerpt(source.extracted_text) ? (
                                                    <div className='text-[11px] text-gray-700 dark:text-gray-300'>{excerpt(source.extracted_text)}</div>
                                                ) : (
                                                    <div className='text-xs text-gray-600 dark:text-gray-300'>No extracted text available</div>
                                                )}
                                                <div className='text-[11px] text-gray-500 dark:text-gray-400'>Click to open the full source drawer.</div>
                                            </div>
                                        )}
                                        <Popover.Arrow className='fill-white dark:fill-gray-950' />
                                    </Popover.Content>
                                </Popover.Portal>
                            </Popover.Root>
                        )
                    }
                }}
            >
                {processed}
            </ReactMarkdown>
        </div>
    )
}