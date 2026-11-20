import { describe, expect, it } from 'vitest'
import { DIAGNOSTICS_CAP, keepNewest, mergeByTime, staleTabs } from './log'
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

describe('keepNewest', () => {
  it('keeps the newest entries of a list, oldest first', () => {
    const entries = ['00', '01', '02'].map((second) =>
      status(`2026-11-20T10:00:${second}.000Z`, 'a'),
    )
    expect(keepNewest(entries, 2)).toEqual(entries.slice(1))
    expect(keepNewest(entries, 5)).toEqual(entries)
    expect(keepNewest(entries, 0)).toEqual([])
  })

  it('caps at 500 entries by default', () => {
    expect(DIAGNOSTICS_CAP).toBe(500)
  })
})

describe('staleTabs', () => {
  const perTab = {
    a: [status('2026-11-20T10:00:00.000Z', 'a'), status('2026-11-20T10:00:01.000Z', 'a')],
    b: [status('2026-11-20T10:00:02.000Z', 'b'), status('2026-11-20T10:00:04.000Z', 'b')],
    c: [status('2026-11-20T10:00:03.000Z', 'c')],
  }

  it('names the tabs none of whose entries are among the newest', () => {
    expect(staleTabs(perTab, 3)).toEqual(['a'])
  })

  it('names no tab while every entry fits', () => {
    expect(staleTabs(perTab, 5)).toEqual([])
  })

  it('keeps a tab with at least one newest entry', () => {
    expect(staleTabs(perTab, 2)).toEqual(['a'])
    expect(staleTabs(perTab, 1)).toEqual(['a', 'c'])
  })

  it('names an empty tab as stale', () => {
    expect(staleTabs({ a: [] }, 5)).toEqual(['a'])
  })
})
