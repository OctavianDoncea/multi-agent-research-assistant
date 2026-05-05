import type { ClaimStatus } from './types'

/** Map API / legacy values onto the three UI statuses. */
export function normalizeClaimStatus(raw: string | undefined | null): ClaimStatus {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
  if (s === 'supported' || s === 'unsupported' || s === 'uncertain') return s
  if (s === 'verified' || s === 'true' || s === 'yes' || s === 'confirm' || s === 'accurate' || s === 'correct'
  )
    return 'supported'
  if (s === 'refuted' || s === 'false' || s === 'no' || s === 'incorrect' || s === 'contradicted') return 'unsupported'
  if (s === 'mixed' || s === 'partial' || s === 'unknown' || s === 'inconclusive') return 'uncertain'
  return 'uncertain'
}
