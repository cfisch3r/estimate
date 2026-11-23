import { describe, expect, it } from 'vitest'
import { readSessionFile } from './sessionFileFormat'

// What users see of the format — reading a saved file back, a newer version,
// files that aren't session files, an unreadable file and the file name — is
// specified in specs/session-persistence/integration/. These tests cover the
// remaining shape checks, one per kind of malformed field.

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

describe('readSessionFile', () => {
  it.each([
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
      error: { code: 'not-a-session-file' },
    })
  })

  it("hands on the domain's refusal of a well-shaped file", () => {
    const text = fileWith({}, { finalResult: { min: 3, expected: 1, max: 6, ci90: 5 } })
    expect(readSessionFile(text)).toEqual({
      ok: false,
      error: {
        code: 'broken-final-result',
        position: 1,
        title: 'A',
        reason: 'has an expected value outside its range',
      },
    })
  })
})
