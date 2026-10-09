import { beforeEach, describe, expect, it } from 'vitest'
import { useSessionStore } from '../stores'
import { finalizeEstimate } from './finalizeEstimate'

beforeEach(() => {
  useSessionStore.setState({
    sessionName: '',
    unit: 'days',
    items: [],
    activeItemId: null,
  })
  useSessionStore.getState().addItem('Story')
})

describe('finalizeEstimate', () => {
  it('aggregates a valid estimate and records it on the item', () => {
    const id = useSessionStore.getState().items[0]!.id
    const outcome = finalizeEstimate(id, 2, 5, 8)

    expect(outcome).toEqual({ ok: true })
    expect(useSessionStore.getState().items[0]!.finalResult).toMatchObject({
      min: 2,
      expected: 5,
      max: 8,
    })
  })

  it('rejects a descending estimate and leaves the item unfinalized', () => {
    const id = useSessionStore.getState().items[0]!.id
    const outcome = finalizeEstimate(id, 10, 5, 3)

    expect(outcome.ok).toBe(false)
    expect(useSessionStore.getState().items[0]!.finalResult).toBeNull()
  })
})
