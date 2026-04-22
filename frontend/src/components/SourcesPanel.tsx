import { useEffect, useMemo, useState } from 'react'
import type { Source } from '../types'

export function SourcesPanel({ sources, highlightSourcesId }: { sources: Source[], highlightSourcesId?: string | null }) {
  const [flashId, setFlashId] = useState<string | null>(null)
  
  const active = useMemo(() => highlightSourcesId ?? flashId, [highlightSourcesId, flashId])

  useEffect(() => {
    if (!highlightSourcesId) return
    setFlashId(highlightSourcesId)
    const t = setTimeout(() => setFlashId(null), 1800)
    return () => clearTimeout(t)
  }, [highlightSourcesId])

  return (
    <div className='space-y-3'>
      {sources.map((s) => {
        const isActive = active === s.source_id
        return (
          <div
            key={s.source_id}
            id={`source-${s.source_id}`}
            className={['border rounded bg-white p-3 dark:bg-gray-900 dark:border-gray-800 scroll-mt-24', isActive ? 'ring-2 ring-yellow-300 border-yellow-300' : ''].join(' ')}
          >
            <div className='flex items-center justify-between gap-3'>
              <div className='font-mono text-xs text-gray-60 dark:text-gray-300'>{s.source_id}</div>
              <a className='text-xs' href={s.url} target='_blank' rel='noreferrer'>Open</a>
            </div>
            <div className='mt-1 font-medium text-sm'>{s.title ?? s.url}</div>
            {s.snippet ? <div className='mt-1 text-xs text-gray-700 dark:text-gray-300'>{s.snippet}</div>: null}
            <div className='mt-2 text-[11px] text-gray-5000 dark:text-gray-400'>Extracted: {s.extracted_text ? 'yes' : 'no'}</div>
          </div>
        )
      })}
      {sources.length === 0 ? <div className="text-sm text-gray-600 dark:text-gray-300">No sources.</div> : null}
    </div>
  )
}