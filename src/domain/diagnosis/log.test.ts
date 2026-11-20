import { describe, expect, it } from 'vitest'
import { DIAGNOSTICS_CAP, mergeByTime, trimToCap } from './log'
import type { DiagnosticEntry } from './types'

const status = (at: string, tab: string): DiagnosticEntry => ({
  kind: 'status',
  status: 'connected',
  at,
  tab,
})

describe('mergeByTime', () => {
  it('merges every tab into one list, oldest first', () => {
    const merged = mergeByTime({
      a: [
        status('2026-11-20T10:00:00.000Z', 'a'),
        status('2026-11-20T10:00:02.000Z', 'a'),
      ],
      b: [status('2026-11-20T10:00:01.000Z', 'b')],
    })
    expect(merged.map((entry) => `${entry.tab}@${entry.at.slice(17, 19)}`)).toEqual([
      'a@00',
      'b@01',
      'a@02',
    ])
  })

  it('keeps the recorded order of entries with the same time', () => {
    const first = {
      ...status('2026-11-20T10:00:00.000Z', 'a'),
      status: 'connecting' as const,
    }
    const second = status('2026-11-20T10:00:00.000Z', 'a')
    expect(mergeByTime({ a: [first, second] })).toEqual([first, second])
  })
})

describe('trimToCap', () => {
  it('drops the oldest entries across all tabs', () => {
    const trimmed = trimToCap(
      {
        a: [
          status('2026-11-20T10:00:00.000Z', 'a'),
          status('2026-11-20T10:00:03.000Z', 'a'),
        ],
        b: [
          status('2026-11-20T10:00:01.000Z', 'b'),
          status('2026-11-20T10:00:02.000Z', 'b'),
          status('2026-11-20T10:00:04.000Z', 'b'),
        ],
      },
      3,
    )
    expect(trimmed).toEqual({
      a: [status('2026-11-20T10:00:03.000Z', 'a')],
      b: [
        status('2026-11-20T10:00:02.000Z', 'b'),
        status('2026-11-20T10:00:04.000Z', 'b'),
      ],
    })
  })

  it('keeps everything under the cap, and keeps a tab whose entries all went', () => {
    const entries = { a: [status('2026-11-20T10:00:00.000Z', 'a')] }
    expect(trimToCap(entries, 5)).toEqual(entries)
    expect(trimToCap(entries, 0)).toEqual({ a: [] })
  })

  it('caps at 500 entries by default', () => {
    expect(DIAGNOSTICS_CAP).toBe(500)
  })
})
