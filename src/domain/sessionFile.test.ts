import { describe, expect, it } from 'vitest'
import {
  hasUnsavedChanges,
  readSessionFile,
  sessionFileName,
  writeSessionFile,
} from './sessionFile'
import type { SavedSession } from './sessionFile'
import { estimateOf, finalizedItemOf, itemOf } from './testFixtures'

// The behaviour users see — file names, the format, every rejection reason —
// is specified in specs/session-persistence/domain/. These tests cover the
// remaining branches and the unsaved-changes rule.

const fileWith = (
  overrides: Record<string, unknown> = {},
  item: Record<string, unknown> = {},
) =>
  JSON.stringify({
    version: 1,
    sessionName: 'S',
    unit: 'days',
    items: [
      { id: 'a', title: 'A', description: '', notes: '', finalResult: null, ...item },
    ],
    ...overrides,
  })

const session = (overrides: Partial<SavedSession> = {}): SavedSession => ({
  sessionName: 'Sprint',
  unit: 'days',
  items: [finalizedItemOf({ id: 'a', title: 'A' })],
  ...overrides,
})

describe('sessionFileName', () => {
  it('keeps digits in the slug', () => {
    expect(sessionFileName('Q3 2026', { year: 2026, month: 12, day: 31 })).toBe(
      'q3-2026-2026-12-31.estimate.json',
    )
  })
})

describe('readSessionFile', () => {
  it.each([
    ['a version that is not a number', fileWith({ version: '1' })],
    ['an older version', fileWith({ version: 0 })],
    ['a non-string session name', fileWith({ sessionName: 3 })],
    ['a non-string unit', fileWith({ unit: null })],
    ['items that are not a list', fileWith({ items: {} })],
    ['an item that is not an object', fileWith({ items: ['a'] })],
    ['an item without notes', fileWith({}, { notes: undefined })],
    ['a final result that is not an object', fileWith({}, { finalResult: 5 })],
    [
      'a final result missing a number',
      fileWith({}, { finalResult: { min: 1, expected: 2, max: 3 } }),
    ],
  ])('rejects %s as not a session file', (_case, text) => {
    expect(readSessionFile(text)).toEqual({
      ok: false,
      error: "This isn't an EstiMate session file.",
    })
  })

  it('rejects an expected value below the minimum', () => {
    const text = fileWith({}, { finalResult: { min: 3, expected: 1, max: 6, ci90: 5 } })
    expect(readSessionFile(text)).toEqual({
      ok: false,
      error: 'Item 1, "A", has an expected value outside its range.',
    })
  })

  it('names the first item that breaks a rule by its position', () => {
    const text = JSON.stringify({
      version: 1,
      sessionName: 'S',
      unit: 'days',
      items: [
        { id: 'a', title: 'A', description: '', notes: '', finalResult: null },
        { id: 'b', title: '  ', description: '', notes: '', finalResult: null },
      ],
    })
    expect(readSessionFile(text)).toEqual({ ok: false, error: 'Item 2 has no title.' })
  })

  it('keeps description and notes', () => {
    const read = readSessionFile(fileWith({}, { description: 'why', notes: 'how' }))
    expect(read.ok && read.value.items[0]).toMatchObject({
      description: 'why',
      notes: 'how',
    })
  })
})

describe('hasUnsavedChanges', () => {
  it('is false for a session nobody has touched', () => {
    expect(hasUnsavedChanges(session({ sessionName: '', items: [] }), null)).toBe(false)
  })

  it('counts a changed unit in a session that was never saved', () => {
    expect(
      hasUnsavedChanges(session({ sessionName: '', items: [], unit: 'weeks' }), null),
    ).toBe(true)
  })

  it('is true for a named or non-empty session that was never saved', () => {
    expect(hasUnsavedChanges(session({ items: [] }), null)).toBe(true)
    expect(hasUnsavedChanges(session({ sessionName: '' }), null)).toBe(true)
  })

  it('is false right after a save', () => {
    const saved = session()
    expect(hasUnsavedChanges(saved, writeSessionFile(saved))).toBe(false)
  })

  it('is true after a durable edit', () => {
    const saved = writeSessionFile(session())
    expect(hasUnsavedChanges(session({ unit: 'weeks' }), saved)).toBe(true)
  })

  it('ignores a running live round', () => {
    const saved = writeSessionFile(session())
    const inRound = session({
      items: [
        finalizedItemOf({
          id: 'a',
          title: 'A',
          submissions: [estimateOf('p')],
          revealed: true,
          round: 1,
        }),
      ],
    })
    expect(hasUnsavedChanges(inRound, saved)).toBe(false)
  })

  it('counts a new item as a change', () => {
    const saved = writeSessionFile(session())
    const more = session({ items: [...session().items, itemOf({ id: 'b', title: 'B' })] })
    expect(hasUnsavedChanges(more, saved)).toBe(true)
  })
})
