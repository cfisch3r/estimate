import { describe, expect, it } from 'vitest'
import { computeCI90 } from './ci90'

describe('computeCI90', () => {
  it('applies McConnell’s formula: expected + 1.28 * ((worst - best) / 3)', () => {
    expect(computeCI90(5, 3, 9)).toBeCloseTo(5 + 1.28 * ((9 - 3) / 3), 10)
    expect(computeCI90(5, 3, 9)).toBeCloseTo(7.56, 10)
  })

  it('returns exactly the expected value when best equals worst (zero spread)', () => {
    expect(computeCI90(10, 10, 10)).toBe(10)
  })

  it('scales linearly with spread width', () => {
    const narrow = computeCI90(10, 8, 12)
    const wide = computeCI90(10, 4, 16)
    expect(wide - 10).toBeCloseTo((narrow - 10) * 3, 10)
  })
})
