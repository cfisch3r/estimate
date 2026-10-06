import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { EstimateIssue } from '../lib/describeEstimateIssue'
import { ISSUE_SETTLE_MS, useSettledIssue } from './useSettledIssue'

const issue = (message: string): EstimateIssue => ({
  headline: 'Out of order',
  message,
  fields: ['best', 'likely'],
})

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useSettledIssue', () => {
  it('shows an issue that is already there on mount straight away', () => {
    const { result } = renderHook(() => useSettledIssue(issue('a')))

    expect(result.current.issue?.message).toBe('a')
  })

  it('holds a new issue back until it has settled', () => {
    const { result, rerender } = renderHook(({ value }) => useSettledIssue(value), {
      initialProps: { value: null as EstimateIssue | null },
    })

    rerender({ value: issue('a') })
    expect(result.current.issue).toBeNull()

    act(() => {
      vi.advanceTimersByTime(ISSUE_SETTLE_MS)
    })
    expect(result.current.issue?.message).toBe('a')
  })

  it('never shows an issue that resolves before it settles', () => {
    const { result, rerender } = renderHook(({ value }) => useSettledIssue(value), {
      initialProps: { value: null as EstimateIssue | null },
    })

    rerender({ value: issue('a') })
    act(() => {
      vi.advanceTimersByTime(ISSUE_SETTLE_MS - 1)
    })
    rerender({ value: null })
    act(() => {
      vi.advanceTimersByTime(ISSUE_SETTLE_MS * 2)
    })

    expect(result.current.issue).toBeNull()
  })

  it('clears a resolved issue immediately', () => {
    const { result, rerender } = renderHook(({ value }) => useSettledIssue(value), {
      initialProps: { value: issue('a') as EstimateIssue | null },
    })
    expect(result.current.issue).not.toBeNull()

    rerender({ value: null })

    expect(result.current.issue).toBeNull()
  })

  it('updates a showing problem in place when it changes to another', () => {
    const { result, rerender } = renderHook(({ value }) => useSettledIssue(value), {
      initialProps: { value: issue('a') as EstimateIssue | null },
    })
    expect(result.current.issue?.message).toBe('a')

    rerender({ value: issue('b') })

    expect(result.current.issue?.message).toBe('b')
  })

  it('shows a re-appearing problem only after it settles again', () => {
    const { result, rerender } = renderHook(({ value }) => useSettledIssue(value), {
      initialProps: { value: issue('a') as EstimateIssue | null },
    })

    rerender({ value: null })
    rerender({ value: issue('a') })
    expect(result.current.issue).toBeNull()

    act(() => {
      vi.advanceTimersByTime(ISSUE_SETTLE_MS)
    })
    expect(result.current.issue?.message).toBe('a')
  })

  it('restarts the wait when a not-yet-shown issue changes', () => {
    const { result, rerender } = renderHook(({ value }) => useSettledIssue(value), {
      initialProps: { value: null as EstimateIssue | null },
    })

    rerender({ value: issue('a') })
    act(() => {
      vi.advanceTimersByTime(ISSUE_SETTLE_MS - 100)
    })
    rerender({ value: issue('b') })
    act(() => {
      vi.advanceTimersByTime(ISSUE_SETTLE_MS - 100)
    })
    expect(result.current.issue).toBeNull()

    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current.issue?.message).toBe('b')
  })

  it('shows the current issue at once when flushed', () => {
    const { result, rerender } = renderHook(({ value }) => useSettledIssue(value), {
      initialProps: { value: null as EstimateIssue | null },
    })
    rerender({ value: issue('a') })

    act(() => {
      result.current.flush()
    })

    expect(result.current.issue?.message).toBe('a')
  })
})
