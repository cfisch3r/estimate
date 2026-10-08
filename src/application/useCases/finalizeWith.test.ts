import { beforeEach, describe, expect, it } from 'vitest'
import { estimateOf } from '../../domain/testFixtures'
import { finalizeWith } from './finalizeWith'
import { useSessionStore } from '../stores'

beforeEach(() => {
  useSessionStore.setState({
    sessionName: '',
    unit: 'days',
    items: [],
    activeItemId: null,
  })
  useSessionStore.getState().addItem('Story')
})

describe('finalizeWith', () => {
  it('records the aggregate of the submissions as the final result', () => {
    const id = useSessionStore.getState().items[0]!.id

    expect(finalizeWith(id, [estimateOf('a'), estimateOf('b')])).toEqual({ ok: true })

    expect(useSessionStore.getState().items[0]?.finalResult).not.toBeNull()
  })

  it('reports an error and records nothing when there are no submissions', () => {
    const id = useSessionStore.getState().items[0]!.id

    expect(finalizeWith(id, []).ok).toBe(false)

    expect(useSessionStore.getState().items[0]?.finalResult).toBeNull()
  })
})
