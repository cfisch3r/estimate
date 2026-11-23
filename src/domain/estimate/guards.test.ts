import { describe, expect, it } from 'vitest'
import {
  checkSymmetricRange,
  checkFalsePrecision,
  checkOutlier,
  checkUncertaintyRange,
} from './guards'
import { est } from './testHelpers'

describe('checkSymmetricRange', () => {
  it('respects a custom tolerance at the boundary', () => {
    // spans of 3 and 5 across a range of 8 -> 25% deviation
    expect(checkSymmetricRange(2, 5, 10, 0.2).fired).toBe(false)
    expect(checkSymmetricRange(2, 5, 10, 0.3).fired).toBe(true)
  })
})

describe('checkFalsePrecision', () => {
  it('does not fire for a non-positive granularity (nothing meaningful to round to)', () => {
    expect(checkFalsePrecision(3.7, 0).fired).toBe(false)
  })
})

describe('checkOutlier', () => {
  const tightGroup = [est('a', 2, 4, 6), est('b', 2, 4, 6), est('c', 2, 4, 6)]

  it('respects a custom threshold', () => {
    // likely = 5.5, others' median likely = 4, others' spread = 4 (2..6) -> 37.5% deviation
    const borderline = est('d', 2, 5.5, 6)
    const all = [...tightGroup, borderline]
    expect(checkOutlier(borderline, all, 0.3).fired).toBe(true)
    expect(checkOutlier(borderline, all, 0.4).fired).toBe(false)
  })
})

describe('checkUncertaintyRange', () => {
  it('computes deviationPct as how far short of the guidance ratio the actual ratio falls', () => {
    // guidance ratio 1.5/0.67 ≈ 2.2388, actual ratio 15/10 = 1.5 -> 1 - 1.5/2.2388 ≈ 0.33
    const result = checkUncertaintyRange(10, 15, 'requirements-complete')
    expect(result.deviationPct).toBeCloseTo(0.33, 2)
  })
})
