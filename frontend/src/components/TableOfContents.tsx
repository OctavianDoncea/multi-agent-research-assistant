import GithubSlugger from 'github-slugger'

export type TableOfContentsItem = { level: number, text: string, id: string }

function stripInlineMarkdown(s: string): string {
    return s
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/_([^_]+)_/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .trim()
}

function removeCodeFences(md: string): string {
    return md.replace(/```[\s\S]*?```/g, '')
}

export function buildTableOfContents(markdown: string): TableOfContentsItem[] {
    const slugger = new GithubSlugger()
    const cleaned = removeCodeFences(markdown)
    const items: TableOfContentsItem[] = []
    const re = /^(#{1,6})\s+(.+)$/gm

    let m: RegExpExecArray | null
    while ((m = re.exec(cleaned))) {
        const level = m[1].length
        const text = stripInlineMarkdown(m[2])
        const id = slugger.slug(text)
        items.push({ level, text, id })
    }
    return items
}

export function TableOfContents({ markdown }: { markdown: string }) {
    const items = buildTableOfContents(markdown)

    if (items.length === 0) return null

    return (
        <div className='border rounded bg-white dark:bg-gray-900 dark:border-gray-800 p-3'>
            <div className='text-xs font-semibold  mb-2'>
                On this page
            </div>
            <ul className='space-y-1'>
                {items.map((it) => (
                    <li key={it.id} style={{ marginLeft: Math.max(0, (it.level - 2) * 10) }}>
                        <a 
                            className='text-xs text-gray-700 dark:text-gray-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded'
                            href={`#h-${it.id}`}
                        >
                            {it.text}    
                        </a>
                    </li>
                ))}
            </ul>
        </div>
    )
}