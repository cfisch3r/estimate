import { describe, expect, it } from 'vitest'
import { createEstimate, validateEstimateValues } from './estimate'

describe('createEstimate', () => {
  it('accepts values in ascending order', () => {
    const result = createEstimate({ participantId: 'a', best: 2, likely: 5, worst: 8 })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual({ participantId: 'a', best: 2, likely: 5, worst: 8 })
    }
  })

  it('accepts equal best, likely, and worst (boundary, not strictly ascending)', () => {
    const result = createEstimate({ participantId: 'a', best: 5, likely: 5, worst: 5 })
    expect(result.ok).toBe(true)
  })

  it('rejects best greater than likely', () => {
    const result = createEstimate({ participantId: 'a', best: 8, likely: 5, worst: 9 })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/best.*likely/i)
    }
  })

  it('rejects likely greater than worst', () => {
    const result = createEstimate({ participantId: 'a', best: 2, likely: 9, worst: 8 })
    expect(result.ok).toBe(false)
  })

  it('rejects a fully descending triple (the case that silently produced a nonsensical CI90 before this factory existed)', () => {
    const result = createEstimate({ participantId: 'a', best: 10, likely: 5, worst: 3 })
    expect(result.ok).toBe(false)
  })

  it('rejects non-finite values', () => {
    expect(
      createEstimate({ participantId: 'a', best: NaN, likely: 5, worst: 8 }).ok,
    ).toBe(false)
    expect(
      createEstimate({ participantId: 'a', best: 2, likely: Infinity, worst: 8 }).ok,
    ).toBe(false)
    expect(
      createEstimate({ participantId: 'a', best: 2, likely: 5, worst: -Infinity }).ok,
    ).toBe(false)
  })

  it('rejects a zero best case', () => {
    const result = createEstimate({ participantId: 'a', best: 0, likely: 5, worst: 8 })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/greater than 0/i)
    }
  })

  it('rejects a negative best case (the ordering check alone lets -2 ≤ 0 ≤ 3 through)', () => {
    const result = createEstimate({ participantId: 'a', best: -2, likely: 0, worst: 3 })
    expect(result.ok).toBe(false)
  })

  it('rejects an empty or whitespace-only participantId', () => {
    expect(createEstimate({ participantId: '', best: 2, likely: 5, worst: 8 }).ok).toBe(
      false,
    )
    expect(
      createEstimate({ participantId: '   ', best: 2, likely: 5, worst: 8 }).ok,
    ).toBe(false)
  })
})

describe('validateEstimateValues', () => {
  it('accepts ascending positive values', () => {
    expect(validateEstimateValues(2, 5, 8)).toEqual({ ok: true })
  })

  it('rejects non-finite, non-positive and out-of-order values', () => {
    expect(validateEstimateValues(NaN, 5, 8).ok).toBe(false)
    expect(validateEstimateValues(0, 5, 8).ok).toBe(false)
    expect(validateEstimateValues(8, 5, 2).ok).toBe(false)
  })

  it('agrees with createEstimate for the same values', () => {
    const values = validateEstimateValues(8, 5, 9)
    const created = createEstimate({ participantId: 'a', best: 8, likely: 5, worst: 9 })

    expect(values.ok).toBe(false)
    expect(created.ok).toBe(false)
    if (!values.ok && !created.ok) expect(values.error).toBe(created.error)
  })
})
