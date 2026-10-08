import { beforeEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { createEstimate } from '../../../domain/estimate'
import { useConnectionStore, useRoundStore, useSessionStore } from '../../../application'
import type { Item } from '../../../domain/types'
import { useRevealRound } from './useRevealRound'

function currentItem(): Item {
  const item = useSessionStore.getState().items[0]
  if (!item) throw new Error('no item')
  return item
}

beforeEach(() => {
  useSessionStore.setState({
    sessionName: '',
    unit: 'days',
    items: [],
    activeItemId: null,
  })
  useSessionStore.getState().addItem('Story')
  useConnectionStore.setState({ participantNames: { p1: 'Ada' } })
})

describe('useRevealRound', () => {
  it('labels the roster from the announced names', () => {
    const { result } = renderHook(() => useRevealRound(currentItem()))

    expect(result.current.roster).toEqual([{ id: 'p1', label: 'Ada', submission: null }])
  })

  it('reveals and retries the given item', () => {
    const id = currentItem().id
    const { result } = renderHook(() => useRevealRound(currentItem()))

    act(() => result.current.reveal())
    expect(currentItem().revealed).toBe(true)

    act(() => result.current.retry())
    expect(currentItem().revealed).toBe(false)
    expect(currentItem().id).toBe(id)
    expect(currentItem().round).toBe(1)
  })

  it('finalizes from the submissions, or reports why it cannot', () => {
    const { result } = renderHook(() => useRevealRound(currentItem()))
    expect(result.current.finalize().ok).toBe(false)

    const estimate = createEstimate({ participantId: 'p1', best: 1, likely: 2, worst: 3 })
    if (!estimate.ok) throw new Error(estimate.error)
    useSessionStore.setState((s) => ({
      items: s.items.map((i) => ({ ...i, submissions: [estimate.value] })),
    }))

    let outcome: { ok: boolean } | undefined
    act(() => {
      outcome = result.current.finalize()
    })
    expect(outcome?.ok).toBe(true)
    expect(currentItem().finalResult).not.toBeNull()
    expect(useRoundStore.getState().liveRound).toBeNull()
  })

  it('reports an unknown item when finalizing one that is gone', () => {
    const { result } = renderHook(() => useRevealRound(currentItem()))
    useSessionStore.setState({ items: [] })

    expect(result.current.finalize()).toEqual({ ok: false, error: 'Unknown item.' })
  })

  it('aggregates the submissions present at call time, not at render time', () => {
    const { result } = renderHook(() => useRevealRound(currentItem()))
    const estimate = createEstimate({ participantId: 'p1', best: 2, likely: 4, worst: 8 })
    if (!estimate.ok) throw new Error(estimate.error)
    useSessionStore.setState((s) => ({
      items: s.items.map((i) => ({ ...i, submissions: [estimate.value] })),
    }))

    expect(result.current.finalize()).toEqual({ ok: true })
    expect(currentItem().finalResult).toMatchObject({ min: 2, max: 8 })
  })
})
