import { beforeEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { createEstimate } from '../../domain/estimate'
import { useRevealActions } from './useRevealActions'
import { useRoundStore, useSessionStore } from '../stores'

function itemId(): string {
  const item = useSessionStore.getState().items[0]
  if (!item) throw new Error('no item')
  return item.id
}

beforeEach(() => {
  useSessionStore.setState({
    sessionName: '',
    unit: 'days',
    items: [],
    activeItemId: null,
  })
  useSessionStore.getState().addItem('Story')
})

describe('useRevealActions', () => {
  it('reveals the given item', () => {
    const { result } = renderHook(() => useRevealActions(itemId()))

    act(() => result.current.reveal())

    expect(useSessionStore.getState().items[0]?.revealed).toBe(true)
  })

  it('finalizes from the submissions present at call time', () => {
    const id = itemId()
    const { result } = renderHook(() => useRevealActions(id))
    const estimate = createEstimate({ participantId: 'p1', best: 1, likely: 2, worst: 3 })
    if (!estimate.ok) throw new Error('bad fixture')
    useSessionStore.setState((s) => ({
      items: s.items.map((i) =>
        i.id === id ? { ...i, submissions: [estimate.value] } : i,
      ),
    }))

    let outcome: ReturnType<typeof result.current.finalize> | undefined
    act(() => {
      outcome = result.current.finalize()
    })

    expect(outcome).toEqual({ ok: true })
    expect(useSessionStore.getState().items[0]?.finalResult).toBeDefined()
  })

  it('reports an unknown item instead of finalizing', () => {
    const { result } = renderHook(() => useRevealActions('missing'))

    expect(result.current.finalize()).toEqual({ ok: false, error: 'Unknown item.' })
    expect(useRoundStore.getState().liveRound).toBeNull()
  })

  it('fails to finalize an item with no submissions', () => {
    const { result } = renderHook(() => useRevealActions(itemId()))

    expect(result.current.finalize().ok).toBe(false)
  })
})
