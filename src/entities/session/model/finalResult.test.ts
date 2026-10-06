import { describe, expect, it } from 'vitest'
import { finalResultFor } from './finalResult'
import { estimateOf } from './testFixtures'

describe('finalResultFor', () => {
  it('refuses an empty submission set', () => {
    expect(finalResultFor([])).toEqual({
      ok: false,
      error: 'No estimates have been submitted yet.',
    })
  })

  it('aggregates the submitted estimates', () => {
    const result = finalResultFor([estimateOf('a', 2, 5, 8), estimateOf('b', 4, 6, 12)])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toMatchObject({ min: 2, max: 12 })
  })
})
