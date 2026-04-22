import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

function linkifyCitations(md: string): string {
    const blockRe = /\[(\s*S\d+(?:-\d+)*\s*(?:,\s*S\d+(?:-\d+)*)*\s*)\]/g

    return md.replace(blockRe, (_match, inside: string) => {
        const ids = inside.split(',').map((s) => s.trim()).filter(Boolean)

        if (ids.length === 0) return _match

        const links = ids.map((id) => `[${id}](#source-${id})`).join(', ')
        return `(${links})`
    })
}

export function MarkdownView({ markdown }: { markdown: string }) {
    const processed = linkifyCitations(markdown)

    return (
        <div className='prose prose-sm max-w-done dark:prose-invert'>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    a: ({ href, children, ...props }) => {
                        const isInternal = typeof href === 'string' && href.startsWith('#source-')
                        return (
                            <a
                                href={href}
                                {...props}
                                target={isInternal ? undefined : '_blank'}
                                rel={isInternal ? undefined : 'noreferrer'}
                                className={isInternal ? 'font-mono text-xs' : undefined}
                            >
                                {children}
                            </a>
                        )
                    }
                }}
            >
                {processed}
            </ReactMarkdown>
        </div>
    )
}