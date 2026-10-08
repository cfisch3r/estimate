import { beforeEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useSessionStore } from '../../entities/session'
import { useFinalizeEstimate } from './useFinalizeEstimate'

beforeEach(() => {
  useSessionStore.setState({
    sessionName: '',
    unit: 'days',
    items: [],
    activeItemId: null,
  })
  useSessionStore.getState().addItem('Story')
})

describe('useFinalizeEstimate', () => {
  it('aggregates a valid estimate and records it on the item', () => {
    const id = useSessionStore.getState().items[0]!.id
    const { result } = renderHook(() => useFinalizeEstimate())

    let outcome: ReturnType<typeof result.current> | undefined
    act(() => {
      outcome = result.current(id, 2, 5, 8)
    })

    expect(outcome).toEqual({ ok: true })
    expect(useSessionStore.getState().items[0]!.finalResult).toMatchObject({
      min: 2,
      expected: 5,
      max: 8,
    })
  })

  it('rejects a descending estimate and leaves the item unfinalized', () => {
    const id = useSessionStore.getState().items[0]!.id
    const { result } = renderHook(() => useFinalizeEstimate())

    let outcome: ReturnType<typeof result.current> | undefined
    act(() => {
      outcome = result.current(id, 10, 5, 3)
    })

    expect(outcome?.ok).toBe(false)
    expect(useSessionStore.getState().items[0]!.finalResult).toBeNull()
  })
})
