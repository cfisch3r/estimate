import { describe, expect, it } from 'vitest'
import { createEstimate, findOrderViolation, validateEstimateValues } from './estimate'

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

  it('names every non-finite field', () => {
    expect(validateEstimateValues(NaN, 5, Infinity)).toMatchObject({
      ok: false,
      code: 'not-finite',
      fields: ['best', 'worst'],
    })
  })

  it('flags a non-positive best case', () => {
    expect(validateEstimateValues(0, 5, 8)).toMatchObject({
      ok: false,
      code: 'non-positive',
      fields: ['best'],
    })
  })

  it('flags best above likely', () => {
    expect(validateEstimateValues(8, 5, 9)).toMatchObject({
      ok: false,
      code: 'best-above-likely',
      fields: ['best', 'likely'],
    })
  })

  it('flags likely above worst', () => {
    expect(validateEstimateValues(2, 9, 8)).toMatchObject({
      ok: false,
      code: 'likely-above-worst',
      fields: ['likely', 'worst'],
    })
  })

  it('reports the first broken pair when both are out of order', () => {
    expect(validateEstimateValues(9, 5, 2)).toMatchObject({ code: 'best-above-likely' })
  })

  it('keeps createEstimate error text in step with the validator', () => {
    const values = validateEstimateValues(8, 5, 9)
    const created = createEstimate({ participantId: 'a', best: 8, likely: 5, worst: 9 })

    expect(created).toEqual({ ok: false, error: values.ok ? '' : values.error })
  })
})

describe('findOrderViolation', () => {
  it('flags the first descending pair among filled values', () => {
    expect(findOrderViolation(10, 5, null)).toEqual({
      code: 'best-above-likely',
      fields: ['best', 'likely'],
    })
    expect(findOrderViolation(null, 9, 4)).toEqual({
      code: 'likely-above-worst',
      fields: ['likely', 'worst'],
    })
  })

  it('compares best with worst when likely is not filled in yet', () => {
    expect(findOrderViolation(9, null, 4)).toEqual({
      code: 'best-above-worst',
      fields: ['best', 'worst'],
    })
  })

  it('returns null when nothing filled descends', () => {
    expect(findOrderViolation(1, null, 4)).toBeNull()
    expect(findOrderViolation(2, 2, 2)).toBeNull()
    expect(findOrderViolation(null, null, null)).toBeNull()
  })
})
