import type { Source } from '../types'

export function SourcesPanel({ sources }: { sources: Source[] }) {
    return (
      <div className="space-y-3">
        {sources.map((s) => (
          <div key={s.source_id} className="border rounded bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="font-mono text-xs text-gray-600">{s.source_id}</div>
              <a className="text-xs" href={s.url} target="_blank" rel="noreferrer">
                Open
              </a>
            </div>
            <div className="mt-1 font-medium text-sm">{s.title ?? s.url}</div>
            {s.snippet ? <div className="mt-1 text-xs text-gray-700">{s.snippet}</div> : null}
            <div className="mt-2 text-[11px] text-gray-500">
              Extracted: {s.extracted_text ? 'yes' : 'no'}
            </div>
          </div>
        ))}
        {sources.length === 0 ? (
          <div className="text-sm text-gray-600">No sources.</div>
        ) : null}
      </div>
    )
  }