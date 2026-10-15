import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { FlagUsageTable, Sparkline, STALE_BADGE_TEXT } from './FlagUsageTable'
import type { FlagUsage } from '../../lib/api.flagusage'

function usage(overrides: Partial<FlagUsage>): FlagUsage {
  return {
    flag_id: 'id',
    flag_key: 'key',
    name: 'Name',
    kind: 'experiment',
    status: 'active',
    evaluations_7d: 0,
    evaluations_30d: 0,
    daily: new Array(30).fill(0),
    variants_30d: {},
    stale: false,
    ...overrides,
  }
}

describe('FlagUsageTable', () => {
  it('shows counts, variant split and no stale badge for a used flag', () => {
    const daily = new Array(30).fill(0)
    daily[29] = 12
    render(<FlagUsageTable staleNote="note" flags={[
      usage({ flag_id: 'a', flag_key: 'checkout', name: 'Checkout', evaluations_7d: 12, evaluations_30d: 1234,
        variants_30d: { off: 34, on: 1200 }, daily, last_evaluated_at: '2026-10-15T09:30:00Z' }),
    ]} />)
    const row = within(screen.getByTestId('usage-row-checkout'))
    expect(row.getByText('1,234')).toBeTruthy()
    expect(row.getByText('on 1,200 · off 34')).toBeTruthy()
    expect(row.getByText('2026-10-15')).toBeTruthy()
    expect(row.queryByText(STALE_BADGE_TEXT)).toBeNull()
  })

  it('labels a stale flag with exactly the 30 day meaning', () => {
    render(<FlagUsageTable staleNote="note" flags={[usage({ flag_key: 'old', stale: true })]} />)
    const row = within(screen.getByTestId('usage-row-old'))
    expect(row.getByText('Stale: no evaluations in 30 d')).toBeTruthy()
    expect(row.getByText('never')).toBeTruthy()
  })

  it('shows an empty state when the project has no flags', () => {
    render(<FlagUsageTable staleNote="note" flags={[]} />)
    expect(screen.getByText('No flags in this project yet.')).toBeTruthy()
  })
})

describe('Sparkline', () => {
  it('starts at zero and draws one point per day', () => {
    const { container } = render(<Sparkline values={[0, 5, 10]} />)
    const points = container.querySelector('polyline')!.getAttribute('points')!.split(' ')
    expect(points).toHaveLength(3)
    expect(points[0].endsWith(',26.0')).toBe(true)
    expect(points[2].endsWith(',2.0')).toBe(true)
  })

  it('does not divide by zero for an all-zero series', () => {
    const { container } = render(<Sparkline values={new Array(30).fill(0)} />)
    expect(container.querySelector('polyline')!.getAttribute('points')).not.toContain('NaN')
  })
})
