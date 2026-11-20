import { beforeEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { createEstimate } from '../../domain/estimate'
import { livePhaseOf } from '../../domain/item'
import { aggregateOf } from '../../domain/testFixtures'
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
        i.id === id ? { ...i, revealed: true, submissions: [estimate.value] } : i,
      ),
    }))

    let outcome: ReturnType<typeof result.current.finalize> | undefined
    act(() => {
      outcome = result.current.finalize()
    })

    expect(outcome).toEqual({ ok: true })
    expect(useSessionStore.getState().items[0]?.finalResult).toBeDefined()
  })

  it('refuses to finalize a round that is not revealed yet', () => {
    const id = itemId()
    const { result } = renderHook(() => useRevealActions(id))
    const estimate = createEstimate({ participantId: 'p1', best: 1, likely: 2, worst: 3 })
    if (!estimate.ok) throw new Error('bad fixture')
    useSessionStore.setState((s) => ({
      items: s.items.map((i) => ({ ...i, submissions: [estimate.value] })),
    }))

    expect(result.current.finalize()).toEqual({
      ok: false,
      error: 'Reveal the round first.',
    })
    expect(useSessionStore.getState().items[0]?.finalResult).toBeNull()
  })

  it('reports an unknown item instead of finalizing', () => {
    const { result } = renderHook(() => useRevealActions('missing'))

    expect(result.current.finalize()).toEqual({ ok: false, error: 'Unknown item.' })
    expect(useRoundStore.getState().liveRound).toBeNull()
  })

  it('fails to finalize a revealed item with no submissions', () => {
    useSessionStore.setState((s) => ({
      items: s.items.map((i) => ({ ...i, revealed: true })),
    }))
    const { result } = renderHook(() => useRevealActions(itemId()))

    const outcome = result.current.finalize()
    expect(outcome.ok).toBe(false)
    expect(outcome).not.toEqual({ ok: false, error: 'Reveal the round first.' })
  })

  // livePhaseOf reads "finalized but not revealed" as "finalized before the
  // load". These pin the invariant that makes that safe: a live round never
  // reaches that state by itself, and a reopen always leaves it.
  describe('the finalized-before-the-load invariant', () => {
    function item() {
      const found = useSessionStore.getState().items[0]
      if (!found) throw new Error('no item')
      return found
    }

    it('keeps an item finalized live in the revealed phase', () => {
      const id = itemId()
      const { result } = renderHook(() => useRevealActions(id))
      const estimate = createEstimate({
        participantId: 'p1',
        best: 1,
        likely: 2,
        worst: 3,
      })
      if (!estimate.ok) throw new Error('bad fixture')
      useSessionStore.setState((s) => ({
        items: s.items.map((i) => ({ ...i, submissions: [estimate.value] })),
      }))

      act(() => result.current.reveal())
      act(() => {
        result.current.finalize()
      })

      expect(item().finalResult).not.toBeNull()
      expect(livePhaseOf(item()).phase).toBe('revealed')
    })

    it.each([
      ['finalized live', { revealed: true }],
      ['finalized before the load', { revealed: false }],
    ])('reopens an item %s into an open round', (_label, state) => {
      const id = itemId()
      useSessionStore.setState((s) => ({
        items: s.items.map((i) => ({
          ...i,
          ...state,
          finalResult: aggregateOf(1, 2, 3),
        })),
      }))
      const { result } = renderHook(() => useRevealActions(id))

      act(() => result.current.retry())

      expect(item().finalResult).toBeNull()
      expect(livePhaseOf(item()).phase).toBe('open')
    })
  })
})
