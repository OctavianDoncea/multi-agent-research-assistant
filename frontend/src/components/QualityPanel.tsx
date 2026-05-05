import type { ClaimCheck, Source } from '../types'
import { normalizeClaimStatus } from '../claimStatus'

function hostFromUrl(url: string): string | null {
    try {
        return new URL(url).hostname.toLowerCase()
    } catch {
        return null
    }
}

type TrustBucket = 'gov' | 'edu' | 'org' | 'reference' | 'news_blog' | 'other'

function classifyHost(host: string | null): TrustBucket {
    if (!host) return 'other'
    if (host.endsWith('.gov')) return 'gov'
    if (host.endsWith('.edu')) return 'edu'
    if (host.endsWith('.org')) return 'org'
    if (host.includes('wikipedia.org') || host.includes('britannica.com')) return 'reference'
    if (host.includes('reuters.com') || host.includes('apnews.com') || host.includes('bbc.') || host.includes('nytimes.com'))
        return 'news_blog'
    return 'other'
}

function badgeClass(bucket: TrustBucket) {
    switch (bucket) {
        case 'gov':
            return 'bg-green-50 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-900'
        case 'edu':
            return 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-900'
        case 'org':
            return 'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-200 dark:border-purple-900'
        case 'reference':
            return 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-maber-900'
        case 'news_blog':
            return 'bg-gray-50 text-gray-800 border-gray-200 dark:bg-gray-900 dark:text-gray-200 dark:border-gray-700'
        default:
            return 'bg-gray-50 text-gray-800 border-gray-200 dark:bg-gray-900 dark:text-gray-200 dark:border-gray-700'
    }
}

export function QualityPanel({ sources, checks }: { sources: Source[], checks: ClaimCheck[] }) {
    const total = sources.length
    const extracted = sources.filter((s) => !!s.extracted_text).length
    const coverage = total === 0 ? 0 : Math.round((extracted / total) * 100)
    const supported = checks.filter((c) => normalizeClaimStatus(c.status) === 'supported').length
    const uncertain = checks.filter((c) => normalizeClaimStatus(c.status) === 'uncertain').length
    const unsupported = checks.filter((c) => normalizeClaimStatus(c.status) === 'unsupported').length

    const buckets: Record<TrustBucket, number> = { gov: 0, edu: 0, org: 0, reference: 0, news_blog: 0, other: 0 }

    for (const s of sources) {
        const host = hostFromUrl(s.url)
        buckets[classifyHost(host)]++
    }

    const bucketEntries = Object.entries(buckets).filter(([, n]) => n > 0) as Array<[TrustBucket, number]>

    return (
        <div className='border rounded bg-white dark:bg-gray-900 dark:border-gray-800 p-3 space-y-3'>
            <div>
                <div className='text-xs font-semibold mb-1'>Quality</div>
                <div className='text-xs text-gray-600 dark:text-gray-300'>Evidence coverage and trust signals (heuristics)</div>
            </div>

            <div className='space-y-1'>
                <div className='flex items-center justify-between text-xs'>
                    <span className='text-gray-700 dark:text-gray-200'>Extraction coverage</span>
                    <span className='font-mono text-gray-700 dark:text-gray-200'>{extracted}/{total} ({coverage}%)</span>
                </div>
                <div className='h-2 rounded bg-gray-200 dark:bg-gray-800 overflow-hidden'>
                    <div className='h-2 bg-blue-500' style={{ width: `${coverage}%` }}></div>
                </div>
            </div>

            <div className='space-y-1'>
                <div className='text-xs font-semibold'>Fact-check summary</div>
                <div className='flex flex-wrap gap-2 text-xs'>
                    <span className='px-2 py-1 rounded border bg-green-50 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-greeen-900'>
                        supported: {supported}
                    </span>
                    <span className='px-2 py-1 rounded border bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-200 dark:border-900'>
                        uncertain: {uncertain}
                    </span>
                    <span className='px-2 py-1 rounded border bg-red-50 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-900'>
                        unsupported: {unsupported}
                    </span>
                </div>
            </div>

            <div className='space-y-1'>
                <div className='text-xs font-semibold'>Source types</div>
                <div className='flex flex-wrap gap-2'>
                    {bucketEntries.map(([b, n]) => (
                        <span key={b} className={`px-2 py-1 text-[11px] border rounded ${badgeClass(b)}`}>
                            {b}: {n}
                        </span>
                    ))}
                    {bucketEntries.length === 0 ? (
                        <span className='text-xs text-gray-600 dark:text-gray-300'>No sources.</span>
                    ) : null}
                </div>
            </div>
        </div>
    )
}