import { describe, expect, it, vi, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { RECONNECT_GRACE_MS, useConnectionPhase } from './useConnectionPhase'

afterEach(() => {
  vi.useRealTimers()
})

describe('useConnectionPhase', () => {
  it('reports ok while the connection is up', () => {
    const { result } = renderHook(() => useConnectionPhase(false))
    expect(result.current).toBe('ok')
  })

  it('holds a fresh drop at reconnecting', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useConnectionPhase(true))

    expect(result.current).toBe('reconnecting')
  })

  it('escalates to lost once the self-healing window has passed', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useConnectionPhase(true))

    act(() => {
      vi.advanceTimersByTime(RECONNECT_GRACE_MS)
    })

    expect(result.current).toBe('lost')
  })

  it('never escalates when the link heals inside the window', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ s }) => useConnectionPhase(s), {
      initialProps: { s: true },
    })
    expect(result.current).toBe('reconnecting')

    rerender({ s: false })
    act(() => {
      vi.advanceTimersByTime(RECONNECT_GRACE_MS * 2)
    })

    expect(result.current).toBe('ok')
  })

  it('restarts the window on a second drop rather than escalating immediately', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ s }) => useConnectionPhase(s), {
      initialProps: { s: true },
    })
    act(() => {
      vi.advanceTimersByTime(RECONNECT_GRACE_MS)
    })
    expect(result.current).toBe('lost')

    rerender({ s: false })
    rerender({ s: true })

    expect(result.current).toBe('reconnecting')
  })

  it('restarts the window when attemptId changes even if isDown stays true', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(
      ({ s, attempt }) => useConnectionPhase(s, attempt),
      { initialProps: { s: true, attempt: 0 } },
    )
    act(() => {
      vi.advanceTimersByTime(RECONNECT_GRACE_MS)
    })
    expect(result.current).toBe('lost')

    rerender({ s: true, attempt: 1 })

    expect(result.current).toBe('reconnecting')
  })
})
