import { useCallback, useEffect, useRef, useState, forwardRef, type ReactNode, type MouseEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import GithubSlugger from 'github-slugger'
import * as Popover from '@radix-ui/react-popover'
import type { Source } from '../types'

/** Normalize e.g. s1-1 → S1-1 for stable map keys and anchors. */
function canonicalSourceId(raw: string): string {
    const t = raw.trim()
    const m = /^([sS])(\d+(?:-\d+)*)$/.exec(t)
    if (!m) return t
    return `S${m[2]}`
}

function isSourceIdToken(id: string): boolean {
    return /^S\d+(?:-\d+)*$/.test(id)
}

function replaceBracketCitations(md: string): string {
    const re = /\[(\s*[sS]\d+(?:-\d+)*\s*(?:,\s*[sS]\d+(?:-\d+)*)*)\]/g
    return md.replace(re, (match, inside: string) => {
        const parts = inside.split(',').map((s) => s.trim()).filter(Boolean)
        const ids = parts.map(canonicalSourceId)
        if (parts.length === 0 || ids.some((id) => !isSourceIdToken(id))) return match
        return ids.map((id) => `[${id}](#source-${id})`).join(', ')
    })
}

function replaceParenCitations(md: string): string {
    const re = /\(\s*((?:[sS]\d+(?:-\d+)*\s*,\s*)*[sS]\d+(?:-\d+)*)\s*\)/g
    return md.replace(re, (match, inside: string) => {
        const parts = inside.split(',').map((s) => s.trim()).filter(Boolean)
        const ids = parts.map(canonicalSourceId)
        if (parts.length === 0 || ids.some((id) => !isSourceIdToken(id))) return match
        return ids.map((id) => `[${id}](#source-${id})`).join(', ')
    })
}

export function linkifyCitations(md: string): string {
    return replaceParenCitations(replaceBracketCitations(md))
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
    const s = text.replace(/\s+/g, ' ').trim()
    if (s.length <= max) return s
    return s.slice(0, max - 1).trimEnd() + '…'
}

const CitationTrigger = forwardRef<
    HTMLAnchorElement,
    {
        href: string
        children?: ReactNode
        onPointerEnter: () => void
        onPointerLeave: () => void
        onClick: (e: MouseEvent<HTMLAnchorElement>) => void
    }
>(function CitationTrigger({ href, children, onPointerEnter, onPointerLeave, onClick }, ref) {
    return (
        <a
            ref={ref}
            href={href}
            className="font-mono text-xs text-blue-600 dark:text-blue-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
            onPointerEnter={onPointerEnter}
            onPointerLeave={onPointerLeave}
            onClick={onClick}
        >
            {children}
        </a>
    )
})

function CitationAnchor({
    href,
    children,
    getSourceById,
    onOpenSource
}: {
    href: string
    children?: ReactNode
    getSourceById: (id: string) => Source | undefined
    onOpenSource: (id: string) => void
}) {
    const sid = href.replace('#source-', '')
    const source = getSourceById(sid)
    const [open, setOpen] = useState(false)
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    const clearCloseTimer = useCallback(() => {
        if (closeTimer.current != null) {
            window.clearTimeout(closeTimer.current)
            closeTimer.current = null
        }
    }, [])

    const scheduleClose = useCallback(() => {
        clearCloseTimer()
        closeTimer.current = window.setTimeout(() => setOpen(false), 180)
    }, [clearCloseTimer])

    useEffect(() => () => clearCloseTimer(), [clearCloseTimer])

    return (
        <Popover.Root open={open} onOpenChange={setOpen} modal={false}>
            <Popover.Trigger asChild>
                <CitationTrigger
                    href={href}
                    onPointerEnter={() => {
                        clearCloseTimer()
                        setOpen(true)
                    }}
                    onPointerLeave={scheduleClose}
                    onClick={(e) => {
                        e.preventDefault()
                        requestAnimationFrame(() => {
                            const el = document.getElementById(`source-${sid}`)
                            el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        })
                        onOpenSource(sid)
                        setOpen(false)
                    }}
                >
                    {children}
                </CitationTrigger>
            </Popover.Trigger>

            <Popover.Portal>
                <Popover.Content
                    side="top"
                    align="center"
                    onPointerEnter={clearCloseTimer}
                    onPointerLeave={scheduleClose}
                    className="z-50 w-80 rounded border bg-white dark:bg-gray-950 dark:border-gray-800 shadow-lg p-3"
                >
                    <div className="text-xs font-semibold mb-1 text-gray-900 dark:text-gray-100">Evidence preview</div>
                    {!source ? (
                        <div className="text-xs text-gray-600 dark:text-gray-300">
                            Unknown source: <span className="font-mono">{sid}</span>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="text-xs text-gray-800 dark:text-gray-200">
                                <span className="font-mono">{source.source_id}</span>
                                {hostFromUrl(source.url) ? (
                                    <span className="text-gray-500 dark:text-gray-400"> · {hostFromUrl(source.url)}</span>
                                ) : null}
                            </div>
                            <div className="text-xs font-medium text-gray-900 dark:text-gray-100">
                                {source.title ?? source.url}
                            </div>
                            {excerpt(source.extracted_text) ? (
                                <div className="text-[11px] leading-relaxed text-gray-700 dark:text-gray-200">
                                    {excerpt(source.extracted_text)}
                                </div>
                            ) : (
                                <div className="text-xs text-gray-600 dark:text-gray-300">No extracted text available</div>
                            )}
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">Click to open the full source drawer.</div>
                        </div>
                    )}
                    <Popover.Arrow className="fill-white dark:fill-gray-950" />
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    )
}

export function MarkdownView({
    markdown,
    getSourceById,
    onOpenSource
}: {
    markdown: string
    getSourceById: (id: string) => Source | undefined
    onOpenSource: (id: string) => void
}) {
    const processed = linkifyCitations(markdown)
    const slugger = new GithubSlugger()

    const resolveSource = useCallback(
        (id: string) => getSourceById(id) ?? getSourceById(canonicalSourceId(id)),
        [getSourceById]
    )

    return (
        <div className="prose prose-sm max-w-none dark:prose-invert">
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
                                    target="_blank"
                                    rel="noreferrer"
                                    className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded break-words"
                                >
                                    {children}
                                </a>
                            )
                        }

                        return (
                            <CitationAnchor href={href!} getSourceById={resolveSource} onOpenSource={onOpenSource}>
                                {children}
                            </CitationAnchor>
                        )
                    }
                }}
            >
                {processed}
            </ReactMarkdown>
        </div>
    )
}
