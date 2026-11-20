import { describe, expect, it } from 'vitest'
import { computeCI90 } from '../../domain/estimate'
import { parseWireEstimate, parseWireFinalResult, parseWireUnit } from './wireParse'

describe('parseWireEstimate', () => {
  it('accepts a well-formed estimate', () => {
    const result = parseWireEstimate({ participantId: 'a', best: 1, likely: 2, worst: 3 })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toMatchObject({ participantId: 'a', likely: 2 })
  })

  it('rejects an order violation', () => {
    expect(
      parseWireEstimate({ participantId: 'a', best: 3, likely: 2, worst: 1 }).ok,
    ).toBe(false)
  })

  it('rejects a blank participantId', () => {
    expect(
      parseWireEstimate({ participantId: ' ', best: 1, likely: 2, worst: 3 }).ok,
    ).toBe(false)
  })

  it.each([null, undefined])(
    'turns a %s payload into a failure instead of throwing',
    (v) => {
      const result = parseWireEstimate(v)
      expect(result.ok).toBe(false)
    },
  )

  it('turns a non-Error throw into a failure with the stringified reason', () => {
    const hostile = {
      get participantId(): string {
        throw 'boom'
      },
    }
    expect(parseWireEstimate(hostile)).toEqual({ ok: false, error: 'boom' })
  })
})

describe('parseWireUnit', () => {
  it('passes a known unit through', () => {
    expect(parseWireUnit('hours', 'days')).toBe('hours')
  })

  it.each(['weeks!', 3, null, undefined])('falls back for %s', (v) => {
    expect(parseWireUnit(v, 'days')).toBe('days')
  })
})

describe('parseWireFinalResult', () => {
  const valid = { min: 2, expected: 3, max: 6, ci90: computeCI90(3, 2, 6) }

  it('accepts a final result that keeps every rule', () => {
    expect(parseWireFinalResult(valid)).toEqual(valid)
  })

  it.each([
    ['missing (older facilitator build)', undefined],
    ['null (pending item)', null],
    ['not an object', 'final'],
    ['missing a field', { min: 2, expected: 3, max: 6 }],
    ['a field that is not a number', { ...valid, max: '6' }],
    ['a range that breaks a rule', { ...valid, min: 9 }],
  ])('treats a final result that is %s as none', (_label, input) => {
    expect(parseWireFinalResult(input)).toBeNull()
  })
})
