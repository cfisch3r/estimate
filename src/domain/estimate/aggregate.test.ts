import { describe, expect, it } from 'vitest'
import { aggregateEstimates } from './aggregate'
import { est } from './testHelpers'

describe('aggregateEstimates', () => {
  it('refuses a strategy whose result breaks the final-result rules', () => {
    // A mean of best cases lands above the median likely case here.
    const estimates = [est('a', 1, 1, 1), est('b', 1, 1, 1), est('c', 100, 100, 100)]
    expect(() =>
      aggregateEstimates(estimates, { best: 'mean', likely: 'median', worst: 'max' }),
    ).toThrow(/expected value outside its range/)
  })

  it('supports a custom per-field strategy (e.g. mean everywhere)', () => {
    const estimates = [est('a', 2, 4, 6), est('b', 4, 6, 8)]
    const result = aggregateEstimates(estimates, {
      best: 'mean',
      likely: 'mean',
      worst: 'mean',
    })
    expect(result.min).toBe(3)
    expect(result.expected).toBe(5)
    expect(result.max).toBe(7)
  })

  it('throws on an empty estimate list', () => {
    expect(() => aggregateEstimates([])).toThrow()
  })
})
