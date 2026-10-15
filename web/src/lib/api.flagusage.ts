// Flag usage report: recorded evaluations per flag over the last 30 UTC days.
// Mirrors service.FlagUsageReport.
import { request } from './api'

export interface FlagUsage {
  flag_id: string
  flag_key: string
  name: string
  kind: string
  status: string
  evaluations_7d: number
  evaluations_30d: number
  /** 30 daily counts, oldest first, the last entry is today (UTC). */
  daily: number[]
  variants_30d: Record<string, number>
  last_evaluated_at?: string
  /** True only when the flag had no evaluations in the last 30 days. */
  stale: boolean
}

export interface FlagUsageReport {
  window_days: number
  /** What the counts mean; show it next to the numbers. */
  counts_note: string
  /** What the stale marker means; show it next to the badge. */
  stale_note: string
  flags: FlagUsage[]
}

export const getFlagUsage = (projectId: string) =>
  request<FlagUsageReport>(`/api/v1/projects/${projectId}/flags/usage`)
