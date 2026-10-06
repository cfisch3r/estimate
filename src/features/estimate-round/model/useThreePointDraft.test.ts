import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { DEFAULT_UNCERTAINTY_INDEX } from '../../../entities/session'
import { ISSUE_SETTLE_MS } from './useSettledIssue'
import { useThreePointDraft } from './useThreePointDraft'

describe('useThreePointDraft', () => {
  it('starts empty and invalid without an initial value', () => {
    const { result } = renderHook(() => useThreePointDraft(null, 'days'))

    expect(result.current.values.best).toBe('')
    expect(result.current.issue).toBeNull()
    expect(result.current.valid).toBe(false)
    expect(result.current.symmetricGuard).toBeNull()
  })

  it('seeds the fields from the initial estimate and validates it', () => {
    const { result } = renderHook(() =>
      useThreePointDraft({ best: 2, likely: 4, worst: 9 }, 'days'),
    )

    expect(result.current.values.best).toBe('2')
    expect(result.current.values.likely).toBe('4')
    expect(result.current.values.worst).toBe('9')
    expect(result.current.valid).toBe(true)
    expect(result.current.issue).toBeNull()
  })

  it('reports a validation error for out-of-order values once the entry settles', () => {
    vi.useFakeTimers()
    try {
      const { result } = renderHook(() => useThreePointDraft(null, 'days'))

      act(() => {
        result.current.setField('best', '9')
        result.current.setField('likely', '4')
        result.current.setField('worst', '2')
      })
      expect(result.current.valid).toBe(false)
      expect(result.current.issue).toBeNull()

      act(() => {
        vi.advanceTimersByTime(ISSUE_SETTLE_MS)
      })
      expect(result.current.issue?.fields).toEqual(['best', 'likely'])
      expect(result.current.issue?.message).toContain('Best case (9 days)')
    } finally {
      vi.useRealTimers()
    }
  })

  it('fires the symmetric guard when likely sits midway', () => {
    const { result } = renderHook(() => useThreePointDraft(null, 'days'))

    act(() => {
      result.current.setField('best', '2')
      result.current.setField('likely', '5')
      result.current.setField('worst', '8')
    })

    expect(result.current.symmetricGuard?.fired).toBe(true)
  })

  describe('phase selection', () => {
    it('starts on the default phase with no guidance until all three values are filled', () => {
      const { result } = renderHook(() => useThreePointDraft(null, 'days'))

      expect(result.current.phaseIndex).toBe(DEFAULT_UNCERTAINTY_INDEX)
      expect(result.current.guidance).toBeNull()
    })

    it('derives guidance from the selected phase', () => {
      const { result } = renderHook(() =>
        useThreePointDraft({ best: 2, likely: 4, worst: 9 }, 'days'),
      )
      const atDefault = result.current.guidance
      expect(atDefault).not.toBeNull()

      act(() => result.current.setPhaseIndex(0))

      expect(result.current.phaseIndex).toBe(0)
      expect(result.current.guidance?.guidanceHigh).not.toBe(atDefault?.guidanceHigh)
    })

    it('yields no guidance for an out-of-range phase index', () => {
      const { result } = renderHook(() =>
        useThreePointDraft({ best: 2, likely: 4, worst: 9 }, 'days'),
      )

      act(() => result.current.setPhaseIndex(99))

      expect(result.current.guidance).toBeNull()
    })
  })
})
