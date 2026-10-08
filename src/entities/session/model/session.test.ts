import { beforeEach, describe, expect, it } from 'vitest'
import { aggregateEstimates, createEstimate } from '../../../domain/estimate'
import { patchItem, useSessionStore } from './session'

function resetStore() {
  useSessionStore.setState({
    sessionName: '',
    unit: 'days',
    items: [],
    activeItemId: null,
  })
}

beforeEach(resetStore)

describe('addItem', () => {
  it('appends a trimmed item with empty description and notes', () => {
    useSessionStore.getState().addItem('  Migrate auth service  ')
    const [item] = useSessionStore.getState().items
    expect(item).toMatchObject({
      title: 'Migrate auth service',
      description: '',
      notes: '',
      finalResult: null,
    })
  })

  it('ignores a blank title', () => {
    useSessionStore.getState().addItem('   ')
    expect(useSessionStore.getState().items).toHaveLength(0)
  })

  it('auto-selects the first item added to an empty workspace', () => {
    useSessionStore.getState().addItem('First')
    const state = useSessionStore.getState()
    expect(state.activeItemId).toBe(state.items[0]?.id)
  })

  it('leaves the active item unchanged when adding a later item', () => {
    const { addItem } = useSessionStore.getState()
    addItem('First')
    const firstId = useSessionStore.getState().items[0]!.id
    addItem('Second')
    expect(useSessionStore.getState().activeItemId).toBe(firstId)
  })
})

describe('reorderItems', () => {
  it('moves an item from one index to another', () => {
    const { addItem, reorderItems } = useSessionStore.getState()
    addItem('A')
    addItem('B')
    addItem('C')
    reorderItems(0, 2)
    const titles = useSessionStore.getState().items.map((i) => i.title)
    expect(titles).toEqual(['B', 'C', 'A'])
  })

  it('is a no-op for an out-of-range index', () => {
    const { addItem, reorderItems } = useSessionStore.getState()
    addItem('A')
    reorderItems(5, 0)
    expect(useSessionStore.getState().items.map((i) => i.title)).toEqual(['A'])
  })
})

describe('setItemDescription', () => {
  it('updates only the targeted item description', () => {
    const { addItem, setItemDescription } = useSessionStore.getState()
    addItem('A')
    addItem('B')
    const [first, second] = useSessionStore.getState().items

    setItemDescription(first!.id, 'Runs lint + tests on every PR')

    const state = useSessionStore.getState()
    expect(state.items[0]).toMatchObject({ description: 'Runs lint + tests on every PR' })
    expect(state.items[1]).toMatchObject({ description: second!.description })
  })
})

describe('removeItem', () => {
  it('clears activeItemId if the removed item was active', () => {
    const { addItem, selectItem, removeItem } = useSessionStore.getState()
    addItem('A')
    const id = useSessionStore.getState().items[0]!.id
    selectItem(id)
    removeItem(id)
    expect(useSessionStore.getState().activeItemId).toBeNull()
    expect(useSessionStore.getState().items).toHaveLength(0)
  })
})

describe('patchItem', () => {
  it('merges the patch into only the targeted item', () => {
    const { addItem } = useSessionStore.getState()
    addItem('A')
    addItem('B')
    const [first, second] = useSessionStore.getState().items

    patchItem(first!.id, { revealed: true, round: 2 })

    const state = useSessionStore.getState()
    expect(state.items[0]).toMatchObject({ revealed: true, round: 2 })
    expect(state.items[1]).toMatchObject({
      revealed: second!.revealed,
      round: second!.round,
    })
  })
})

describe('selectFirstPending', () => {
  it('selects the first item that has no final result yet', () => {
    const { addItem } = useSessionStore.getState()
    addItem('A')
    addItem('B')
    const [first, second] = useSessionStore.getState().items
    const estimate = createEstimate({ participantId: 'p', best: 1, likely: 2, worst: 3 })
    if (!estimate.ok) throw new Error(estimate.error)
    patchItem(first!.id, { finalResult: aggregateEstimates([estimate.value]) })

    useSessionStore.getState().selectFirstPending()

    expect(useSessionStore.getState().activeItemId).toBe(second!.id)
  })

  it('clears the selection when there are no items', () => {
    useSessionStore.getState().selectItem('stale')
    useSessionStore.getState().selectFirstPending()
    expect(useSessionStore.getState().activeItemId).toBeNull()
  })
})

describe('resetUnit', () => {
  it('returns the unit to the default', () => {
    useSessionStore.getState().setUnit('weeks')
    useSessionStore.getState().resetUnit()
    expect(useSessionStore.getState().unit).toBe('days')
  })
})

describe('clearSession', () => {
  it('resets items, session name and active item', () => {
    useSessionStore.setState({ sessionName: 'My session' })
    useSessionStore.getState().addItem('Item A')

    useSessionStore.getState().clearSession()

    expect(useSessionStore.getState()).toMatchObject({
      items: [],
      sessionName: '',
      activeItemId: null,
    })
  })
})
