import { describe, expect, it } from 'vitest'
import { createEstimate, estimateErrorText } from './estimate'

describe('createEstimate', () => {
  it.each(['', '   '])('rejects the participantId %j as missing', (participantId) => {
    const result = createEstimate({ participantId, best: 2, likely: 5, worst: 8 })

    expect(result).toEqual({ ok: false, error: { code: 'no-participant' } })
    if (!result.ok) {
      expect(estimateErrorText(result.error)).toBe('participantId must not be empty')
    }
  })
})
