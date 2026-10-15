import type { CSSProperties } from 'react'
import type { FlagUsage } from '../../lib/api.flagusage'
import { C } from './shared'

export const STALE_BADGE_TEXT = 'Stale: no evaluations in 30 d'

const SPARK_W = 120
const SPARK_H = 28

// Sparkline draws the daily counts as a polyline. The y axis starts at zero so
// a quiet flag looks quiet.
export function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(1, ...values)
  const step = values.length > 1 ? SPARK_W / (values.length - 1) : 0
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(SPARK_H - 2 - (v / max) * (SPARK_H - 4)).toFixed(1)}`)
    .join(' ')
  return (
    <svg width={SPARK_W} height={SPARK_H} role="img" aria-label={`Daily evaluations, last ${values.length} days`}>
      <polyline fill="none" stroke={C.amber} strokeWidth={1.5} points={points} />
    </svg>
  )
}

function staleBadge(note: string) {
  return (
    <span title={note} style={{
      fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
      background: 'rgba(148,163,184,0.12)', color: C.muted,
      border: `1px solid ${C.muted}33`, borderRadius: 99, padding: '0.15rem 0.6rem',
    }}>
      {STALE_BADGE_TEXT}
    </span>
  )
}

function variantSplit(variants: Record<string, number>): string {
  const entries = Object.entries(variants).sort((a, b) => b[1] - a[1])
  return entries.length === 0 ? '' : entries.map(([name, n]) => `${name} ${n.toLocaleString()}`).join(' · ')
}

function lastSeen(flag: FlagUsage): string {
  if (!flag.last_evaluated_at) return 'never'
  const d = new Date(flag.last_evaluated_at)
  return Number.isNaN(d.getTime()) ? 'unknown' : d.toISOString().slice(0, 10)
}

const th: CSSProperties = {
  textAlign: 'left', fontSize: 12, fontWeight: 600, color: C.muted, padding: '0.5rem 0.75rem',
  textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${C.border}`,
}
const td: CSSProperties = { padding: '0.65rem 0.75rem', fontSize: 14, borderBottom: `1px solid ${C.border}`, verticalAlign: 'middle' }

export function FlagUsageTable({ flags, staleNote }: { flags: FlagUsage[]; staleNote: string }) {
  if (flags.length === 0) {
    return <div style={{ color: C.muted, padding: '2rem', textAlign: 'center' }}>No flags in this project yet.</div>
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>Flag</th>
            <th style={th}>Last 30 days</th>
            <th style={{ ...th, textAlign: 'right' }}>7 d</th>
            <th style={{ ...th, textAlign: 'right' }}>30 d</th>
            <th style={th}>Variants (30 d)</th>
            <th style={th}>Last evaluated</th>
          </tr>
        </thead>
        <tbody>
          {flags.map((f) => (
            <tr key={f.flag_id} data-testid={`usage-row-${f.flag_key}`}>
              <td style={td}>
                <div style={{ fontWeight: 700, color: C.text }}>{f.name}</div>
                <code style={{ fontSize: 12, color: C.muted }}>{f.flag_key}</code>
                {f.kind === 'config' && <span style={{ fontSize: 11, color: C.muted, marginLeft: 8 }}>config</span>}
                {f.stale && <div style={{ marginTop: 4 }}>{staleBadge(staleNote)}</div>}
              </td>
              <td style={td}><Sparkline values={f.daily} /></td>
              <td style={{ ...td, textAlign: 'right', color: C.text }}>{f.evaluations_7d.toLocaleString()}</td>
              <td style={{ ...td, textAlign: 'right', color: C.text, fontWeight: 700 }}>{f.evaluations_30d.toLocaleString()}</td>
              <td style={{ ...td, color: C.muted, fontSize: 13 }}>{variantSplit(f.variants_30d)}</td>
              <td style={{ ...td, color: C.muted, fontSize: 13 }}>{lastSeen(f)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
