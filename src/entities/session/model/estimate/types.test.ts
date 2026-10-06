import { describe, expect, it } from 'vitest'
import { ESTIMATION_UNITS, isEstimationUnit } from './types'

describe('isEstimationUnit', () => {
  it('accepts every member of ESTIMATION_UNITS', () => {
    for (const unit of ESTIMATION_UNITS) {
      expect(isEstimationUnit(unit)).toBe(true)
    }
  })

  it('rejects unknown strings and non-string values', () => {
    for (const value of [
      'fortnights',
      'day',
      'Days',
      '',
      0,
      1,
      null,
      undefined,
      {},
      ['days'],
    ]) {
      expect(isEstimationUnit(value)).toBe(false)
    }
  })
})
