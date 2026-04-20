import type { ClaimCheck } from "../types";

function badgeClass(status: ClaimCheck['status']) {
    if (status === 'supported') return 'bg-green-100 text-green-800 border-green-200'
    if (status === 'unsupported') return 'bg-red-100 text-red-800 border-red-200'
    return 'bg-yellow-100 text-yellow-800 border-yellow-200'
}

export function FactChecksPanel({ checks }: { checks: ClaimCheck[] }) {
    return (
        <div className="space-y-3">
            {checks.map((c, idx) => (
                <div key={idx} className="border rounded bg-white p-3">
                    <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs border rounded ${badgeClass(c.status)}`}>
                            {c.status}
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