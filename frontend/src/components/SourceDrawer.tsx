import { Copy, Link2, X } from 'lucide-react'
import { toast } from 'sonner'
import type { Source } from '../types'
import { Button } from './ui/button'
import { Sheet, SheetClose, SheetContent, SheetTitle } from './ui/sheet'
import { cn } from '../lib/utils'

function hostFromUrl(url: string): string | null {
    try {
        return new URL(url).hostname
    } catch {
        return null
    }
}

async function copyToClipboard(text: string): Promise<boolean> {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text)
            return true
        }
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        document.execCommand('copy')
        ta.remove()
        return true
    } catch {
        return false
    }
}

export function SourceDrawer({
    open,
    onOpenChange,
    source
}: {
    open: boolean
    onOpenChange: (v: boolean) => void
    source: Source | null
}) {
    const citation = source ? `[${source.source_id}]` : ''

    async function handleCopyCitation() {
        if (!source) return
        const ok = await copyToClipboard(citation)
        if (ok) toast.success('Citation copied')
        else toast.error('Could not copy citation')
    }

    async function handleCopyUrl() {
        if (!source) return
        const ok = await copyToClipboard(source.url)
        if (ok) toast.success('URL copied')
        else toast.error('Could not copy URL')
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className="w-full max-w-xl border-l border-border p-0 sm:max-w-xl"
            >
                <div className="border-b border-border bg-gradient-to-br from-primary/[0.07] via-transparent to-transparent px-6 py-5">
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <SheetTitle className="text-left text-xl font-bold tracking-tight text-foreground">
                                Source details
                            </SheetTitle>
                            {source ? (
                                <p className="mt-2 text-sm font-medium text-muted-foreground">
                                    <span className="font-mono text-foreground">{source.source_id}</span>
                                    {hostFromUrl(source.url) ? (
                                        <span className="text-muted-foreground"> · {hostFromUrl(source.url)}</span>
                                    ) : null}
                                </p>
                            ) : null}
                        </div>
                        <SheetClose asChild>
                            <Button variant="ghost" size="icon" className="shrink-0 rounded-full" aria-label="Close">
                                <X className="h-5 w-5" />
                            </Button>
                        </SheetClose>
                    </div>

                    {source ? (
                        <div className="mt-5 flex flex-wrap gap-2">
                            <Button
                                type="button"
                                variant="default"
                                size="sm"
                                className="font-semibold shadow-soft"
                                onClick={() => void handleCopyCitation()}
                            >
                                <Link2 className="h-4 w-4" />
                                Copy citation
                            </Button>
                            <Button type="button" variant="secondary" size="sm" onClick={() => void handleCopyUrl()}>
                                <Copy className="h-4 w-4" />
                                Copy URL
                            </Button>
                        </div>
                    ) : null}
                </div>

                {!source ? (
                    <div className="px-6 py-8 text-sm text-muted-foreground">No source selected.</div>
                ) : (
                    <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-6">
                        <div>
                            <h3 className="text-base font-semibold leading-snug text-foreground">
                                {source.title ?? 'Untitled source'}
                            </h3>
                            <a
                                className="mt-2 inline-flex text-sm font-medium text-primary hover:underline"
                                href={source.url}
                                target="_blank"
                                rel="noreferrer"
                            >
                                Open in new tab
                            </a>
                            {source.snippet ? (
                                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{source.snippet}</p>
                            ) : null}
                        </div>

                        <div className="rounded-xl border border-border bg-muted/30 p-4">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Extracted excerpts
                            </h4>
                            {source.extracted_text ? (
                                <pre
                                    className={cn(
                                        'mt-3 max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-border',
                                        'bg-card p-4 text-[13px] leading-relaxed text-foreground',
                                        'break-words font-sans'
                                    )}
                                >
                                    {source.extracted_text}
                                </pre>
                            ) : (
                                <p className="mt-3 text-sm text-muted-foreground">
                                    No extracted text available for this source.
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    )
}
