import { describe, expect, it, vi, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { RECONNECT_GRACE_MS, useConnectionPhase } from './useConnectionPhase'

afterEach(() => {
  vi.useRealTimers()
})

describe('useConnectionPhase', () => {
  it('reports ok while connected', () => {
    const { result } = renderHook(() => useConnectionPhase('connected'))
    expect(result.current).toBe('ok')
  })

  it('reports ok while still connecting — a first join is not a loss', () => {
    const { result } = renderHook(() => useConnectionPhase('connecting'))
    expect(result.current).toBe('ok')
  })

  it('holds a fresh disconnect at reconnecting', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useConnectionPhase('disconnected'))

    expect(result.current).toBe('reconnecting')
  })

  it('escalates to lost once the self-healing window has passed', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useConnectionPhase('disconnected'))

    act(() => {
      vi.advanceTimersByTime(RECONNECT_GRACE_MS)
    })

    expect(result.current).toBe('lost')
  })

  it('never escalates when the link heals inside the window', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ s }) => useConnectionPhase(s), {
      initialProps: { s: 'disconnected' as const },
    })
    expect(result.current).toBe('reconnecting')

    rerender({ s: 'connected' as unknown as 'disconnected' })
    act(() => {
      vi.advanceTimersByTime(RECONNECT_GRACE_MS * 2)
    })

    expect(result.current).toBe('ok')
  })

  it('restarts the window on a second drop rather than escalating immediately', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ s }) => useConnectionPhase(s), {
      initialProps: { s: 'disconnected' as 'disconnected' | 'connected' },
    })
    act(() => {
      vi.advanceTimersByTime(RECONNECT_GRACE_MS)
    })
    expect(result.current).toBe('lost')

    rerender({ s: 'connected' })
    rerender({ s: 'disconnected' })

    expect(result.current).toBe('reconnecting')
  })
})
