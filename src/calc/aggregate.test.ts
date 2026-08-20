import { describe, expect, it } from 'vitest'
import { aggregateEstimates, median } from './aggregate'
import { est } from './testHelpers'

describe('aggregateEstimates', () => {
  it('degenerates to the raw values for a single estimate (Mode B path)', () => {
    const result = aggregateEstimates([est('facilitator', 3, 5, 9)])
    expect(result.min).toBe(3)
    expect(result.expected).toBe(5)
    expect(result.max).toBe(9)
    expect(result.ci90).toBeCloseTo(5 + 1.28 * ((9 - 3) / 3), 10)
  })

  it('defaults to min(Best) / median(Likely) / max(Worst) across many estimates', () => {
    const estimates = [est('a', 2, 5, 8), est('b', 1, 6, 10), est('c', 3, 4, 9)]
    const result = aggregateEstimates(estimates)
    expect(result.min).toBe(1)
    expect(result.expected).toBe(5)
    expect(result.max).toBe(10)
  })

  it('does not average away outliers with the default strategy', () => {
    // A single very high Worst Case should raise the group max, not get averaged down.
    const estimates = [est('a', 2, 4, 6), est('b', 2, 4, 6), est('c', 2, 4, 20)]
    const result = aggregateEstimates(estimates)
    expect(result.max).toBe(20)
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

describe('median', () => {
  it('returns the middle value for an odd-length array', () => {
    expect(median([5, 1, 3])).toBe(3)
  })

  it('averages the two middle values for an even-length array', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })

  it('returns the value itself for a single-element array', () => {
    expect(median([7])).toBe(7)
  })
})
