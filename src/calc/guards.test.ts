import { describe, expect, it } from 'vitest'
import { checkSymmetricRange, checkFalsePrecision, checkOutlier } from './guards'
import { UNIT_GRANULARITY } from './types'
import { est } from './testHelpers'

describe('checkSymmetricRange', () => {
  it('fires when Best-to-Likely and Likely-to-Worst spans are equal', () => {
    // best=2, likely=5, worst=8 -> spans of 3 and 3, perfectly symmetric
    const result = checkSymmetricRange(2, 5, 8)
    expect(result.fired).toBe(true)
    expect(result.deviationPct).toBeCloseTo(0, 10)
  })

  it('does not fire when the worst-case span is well beyond tolerance', () => {
    // best=2, likely=4, worst=10 -> spans of 2 and 6 across a range of 8 (50% deviation)
    const result = checkSymmetricRange(2, 4, 10)
    expect(result.fired).toBe(false)
    expect(result.deviationPct).toBeCloseTo(0.5, 10)
  })

  it('respects a custom tolerance at the boundary', () => {
    // spans of 3 and 5 across a range of 8 -> 25% deviation
    expect(checkSymmetricRange(2, 5, 10, 0.2).fired).toBe(false)
    expect(checkSymmetricRange(2, 5, 10, 0.3).fired).toBe(true)
  })

  it('does not fire when best equals worst (zero range, no signal)', () => {
    expect(checkSymmetricRange(5, 5, 5).fired).toBe(false)
  })
})

describe('checkFalsePrecision', () => {
  it('fires on a non-round value like 3.7 days at 0.5-day granularity', () => {
    const result = checkFalsePrecision(3.7, UNIT_GRANULARITY.days)
    expect(result.fired).toBe(true)
  })

  it('does not fire on a value already at the granularity for days', () => {
    expect(checkFalsePrecision(3.5, UNIT_GRANULARITY.days).fired).toBe(false)
    expect(checkFalsePrecision(4, UNIT_GRANULARITY.days).fired).toBe(false)
  })

  it('does not fire on a whole-hour value at hours granularity', () => {
    expect(checkFalsePrecision(6, UNIT_GRANULARITY.hours).fired).toBe(false)
  })

  it('fires on a fractional-hour value at hours granularity', () => {
    expect(checkFalsePrecision(6.25, UNIT_GRANULARITY.hours).fired).toBe(true)
  })

  it('does not fire on a value already at the granularity for weeks', () => {
    expect(checkFalsePrecision(2.5, UNIT_GRANULARITY.weeks).fired).toBe(false)
  })

  it('does not fire for a non-positive granularity (nothing meaningful to round to)', () => {
    expect(checkFalsePrecision(3.7, 0).fired).toBe(false)
  })
})

describe('checkOutlier', () => {
  const tightGroup = [est('a', 2, 4, 6), est('b', 2, 4, 6), est('c', 2, 4, 6)]

  it('flags a participant whose range does not overlap the rest of the group', () => {
    const outlier = est('d', 10, 15, 20)
    const result = checkOutlier(outlier, [...tightGroup, outlier])
    expect(result.fired).toBe(true)
  })

  it('does not flag a participant consistent with the rest of the group', () => {
    const consistent = est('a', 2, 4, 6)
    const result = checkOutlier(consistent, [...tightGroup, est('d', 10, 15, 20)])
    expect(result.fired).toBe(false)
    expect(result.deviationPct).toBeCloseTo(0, 10)
  })

  it('does not fire when there is only one estimate (nothing to compare against)', () => {
    const solo = est('a', 2, 4, 6)
    expect(checkOutlier(solo, [solo]).fired).toBe(false)
  })

  it('falls back to overlap-only when the rest of the group has zero spread', () => {
    // others all agree on the exact same single value (5,5,5) -> spread is 0, so
    // deviationPct would be a division by zero; overlap is the only signal left.
    const unanimous = [est('a', 5, 5, 5), est('b', 5, 5, 5), est('c', 5, 5, 5)]

    const overlapping = est('d', 5, 5, 5)
    expect(checkOutlier(overlapping, [...unanimous, overlapping]).fired).toBe(false)

    const disjoint = est('e', 10, 15, 20)
    expect(checkOutlier(disjoint, [...unanimous, disjoint]).fired).toBe(true)
  })

  it('respects a custom threshold', () => {
    // likely = 5.5, others' median likely = 4, others' spread = 4 (2..6) -> 37.5% deviation
    const borderline = est('d', 2, 5.5, 6)
    const all = [...tightGroup, borderline]
    expect(checkOutlier(borderline, all, 0.3).fired).toBe(true)
    expect(checkOutlier(borderline, all, 0.4).fired).toBe(false)
  })
})
