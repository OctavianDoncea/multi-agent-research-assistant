import { useEffect, useMemo, useState } from 'react'
import type { Source } from '../types'
import  { Card, CardContent } from './ui/card'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { cn } from '../lib/utils'
import { ExternalLink } from 'lucide-react'

function host(url: string): string | null {
  try { return new URL(url).hostname } catch { return null }
}

function faviconUrl(url: string): string | null {
  const h = host(url)
  if (!h) return null
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(h)}&sz=64`
}

export function SourcesPanel({ sources, highlightSourcesId, onOpenSource }: { sources: Source[], highlightSourcesId?: string | null, onOpenSource: (id: string) => void }) {
  const [flashId, setFlashId] = useState<string | null>(null)
  const active = useMemo(() => highlightSourcesId ?? flashId, [highlightSourcesId, flashId])

  useEffect(() => {
    if (!highlightSourcesId) return
    setFlashId(highlightSourcesId)
    const t = setTimeout(() => setFlashId(null), 1800)
    return () => clearTimeout(t)
  }, [highlightSourcesId])

  return (
    <div className="space-y-3">
      {sources.map((s) => {
        const isActive = active === s.source_id
        const h = host(s.url)
        return (
          <Card
            key={s.source_id}
            id={`source-${s.source_id}`}
            className={cn('scroll-mt-24 transition', isActive ? 'ring-2 ring-ring' : '')}
          >
            <CardContent className="pt-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {faviconUrl(s.url) ? (
                      <img src={faviconUrl(s.url)!} alt="" className="h-5 w-5 rounded" />
                    ) : null}

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 font-mono text-xs"
                      onClick={() => onOpenSource?.(s.source_id)}
                      aria-label={`Open details for source ${s.source_id}`}
                      type="button"
                    >
                      {s.source_id}
                    </Button>

                    {h ? <span className="text-[11px] text-muted-foreground truncate">{h}</span> : null}
                  </div>

                  <div className="mt-2 font-medium text-sm break-words">{s.title ?? s.url}</div>
                  {s.snippet ? (
                    <div className="mt-1 text-xs text-muted-foreground">{s.snippet}</div>
                  ) : null}
                </div>

                <a href={s.url} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="icon" aria-label="Open source in new tab">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </a>
              </div>

              <div className="flex flex-wrap gap-2">
                {s.extracted_text ? (
                  <Badge variant="success">extracted</Badge>
                ) : (
                  <Badge variant="warning">no extract</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}

      {sources.length === 0 ? (
        <div className="text-sm text-muted-foreground">No sources.</div>
      ) : null}
    </div>
  )
}