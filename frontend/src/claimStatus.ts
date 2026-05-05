import type { ClaimStatus } from './types'

/** Map API / legacy values onto the three UI statuses. */
export function normalizeClaimStatus(raw: string | undefined | null): ClaimStatus {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
  if (s === 'supported' || s === 'unsupported' || s === 'uncertain') return s
  return 'uncertain'
}
