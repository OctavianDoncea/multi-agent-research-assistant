import type { ClaimCheck } from "../types";
import { normalizeClaimStatus } from "../claimStatus";

function badgeClass(status: ClaimCheck['status']) {
    const s = normalizeClaimStatus(status)
    if (s === 'supported') return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-900'
    if (s === 'unsupported') return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-900'
    return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-200 dark:border-yellow-900'
}

export function FactChecksPanel({ checks }: { checks: ClaimCheck[] }) {
    return (
        <div className="space-y-3">
            {checks.map((c, idx) => (
                <div key={idx} className="border rounded bg-white dark:bg-gray-900 dark:border-gray-800 p-3">
                    <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs border rounded ${badgeClass(c.status)}`}>
                            {normalizeClaimStatus(c.status)}
                        </span>
                        <span className="text-xs text-gray-600">
                            Evidence: {c.evidence_source_ids?.join(', ') || '-'}
                        </span>
                    </div>
                    <div className="mt-2 text-sm">{c.claim}</div>
                    {c.notes ? <div className="mt-1 text-xs text-gray-600">{c.notes}</div> : null}
                </div>
            ))}
            {checks.length === 0 ? <div className="text-sm text-gray-600">No fact checks</div> : null}
        </div>
    )
}