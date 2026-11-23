import { describe, expect, it } from 'vitest'
import { createEstimate, validateEstimateValues } from './estimate'

describe('createEstimate', () => {
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
  it('reports the first broken pair when both are out of order', () => {
    expect(validateEstimateValues(9, 5, 2)).toMatchObject({ code: 'best-above-likely' })
  })

  it('keeps createEstimate error text in step with the validator', () => {
    const values = validateEstimateValues(8, 5, 9)
    const created = createEstimate({ participantId: 'a', best: 8, likely: 5, worst: 9 })

    expect(created).toEqual({ ok: false, error: values.ok ? '' : values.error })
  })
})
