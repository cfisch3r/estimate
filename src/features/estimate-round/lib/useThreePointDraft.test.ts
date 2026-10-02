import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useThreePointDraft } from './useThreePointDraft'

describe('useThreePointDraft', () => {
  it('starts empty and invalid without an initial value', () => {
    const { result } = renderHook(() => useThreePointDraft(null))

    expect(result.current.best).toBe('')
    expect(result.current.validation).toBeNull()
    expect(result.current.valid).toBe(false)
    expect(result.current.symmetricGuard).toBeNull()
  })

  it('seeds the fields from the initial estimate and validates it', () => {
    const { result } = renderHook(() =>
      useThreePointDraft({ best: 2, likely: 4, worst: 9 }),
    )

    expect(result.current.best).toBe('2')
    expect(result.current.likely).toBe('4')
    expect(result.current.worst).toBe('9')
    expect(result.current.valid).toBe(true)
    expect(result.current.validationError).toBeNull()
  })

  it('reports a validation error for out-of-order values', () => {
    const { result } = renderHook(() => useThreePointDraft(null))

    act(() => {
      result.current.setBest('9')
      result.current.setLikely('4')
      result.current.setWorst('2')
    })

    expect(result.current.valid).toBe(false)
    expect(result.current.validationError).toEqual(expect.any(String))
  })

  it('fires the symmetric guard when likely sits midway', () => {
    const { result } = renderHook(() => useThreePointDraft(null))

    act(() => {
      result.current.setBest('2')
      result.current.setLikely('5')
      result.current.setWorst('8')
    })

    expect(result.current.symmetricGuard?.fired).toBe(true)
  })
})
