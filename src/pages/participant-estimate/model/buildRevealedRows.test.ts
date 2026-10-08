import { describe, expect, it } from 'vitest'
import { createEstimate, type Estimate } from '../../../domain/estimate'
import { buildRevealedRows } from './buildRevealedRows'

function est(participantId: string): Estimate {
  const result = createEstimate({ participantId, best: 1, likely: 2, worst: 3 })
  if (!result.ok) throw new Error(result.error)
  return result.value
}

describe('buildRevealedRows', () => {
  it('labels this client "You" and keeps the estimate on the row', () => {
    const mine = est('me')
    const [row] = buildRevealedRows([mine], 'me', {})

    expect(row).toEqual({ participantId: 'me', label: 'You', estimate: mine })
  })

  it('prefers an announced name over the teammate fallback', () => {
    const rows = buildRevealedRows([est('a'), est('b')], 'me', { a: 'Ada' })

    expect(rows.map((r) => r.label)).toEqual(['Ada', 'Teammate 2'])
  })

  it('numbers teammates by position among non-self rows, skipping self', () => {
    const rows = buildRevealedRows([est('a'), est('me'), est('b')], 'me', {})

    expect(rows.map((r) => r.label)).toEqual(['Teammate 1', 'You', 'Teammate 2'])
  })

  it('keeps a teammate number stable when another peer announces a name', () => {
    const subs = [est('a'), est('b')]
    const before = buildRevealedRows(subs, 'me', {})
    const after = buildRevealedRows(subs, 'me', { a: 'Ada' })

    expect(before[1]?.label).toBe('Teammate 2')
    expect(after[1]?.label).toBe('Teammate 2')
  })

  it('ignores an announced name that collides with an Object.prototype key', () => {
    const rows = buildRevealedRows([est('toString')], 'me', {})

    expect(rows[0]?.label).toBe('Teammate 1')
  })

  it('returns no rows for no submissions', () => {
    expect(buildRevealedRows([], 'me', {})).toEqual([])
  })
})
