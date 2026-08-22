import { beforeEach, describe, expect, it } from 'vitest'
import { useSessionStore } from './store'

function resetStore() {
  useSessionStore.setState({
    currentScreen: 'create',
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

describe('createSession', () => {
  it('refuses to advance the screen when the session name is blank', () => {
    useSessionStore.getState().createSession()
    expect(useSessionStore.getState().currentScreen).toBe('create')
  })

  it('refuses to advance the screen when there are no items, even with a name set', () => {
    useSessionStore.getState().setSessionName('Sprint 14')
    useSessionStore.getState().createSession()
    expect(useSessionStore.getState().currentScreen).toBe('create')
  })

  it('advances to the session screen and selects the first item once named', () => {
    const { setSessionName, addItem, createSession } = useSessionStore.getState()
    setSessionName('Sprint 14')
    addItem('First item')
    addItem('Second item')
    createSession()
    const state = useSessionStore.getState()
    expect(state.currentScreen).toBe('session')
    expect(state.activeItemId).toBe(state.items[0]?.id)
  })
})

describe('finalizeItem', () => {
  it('rejects an invalid estimate and leaves the item unfinalized', () => {
    const { setSessionName, addItem, createSession, finalizeItem } =
      useSessionStore.getState()
    setSessionName('Sprint 14')
    addItem('Only item')
    createSession()
    const id = useSessionStore.getState().items[0]!.id

    const result = finalizeItem(id, 10, 5, 3) // descending, invalid
    expect(result.ok).toBe(false)
    expect(useSessionStore.getState().items[0]!.finalResult).toBeNull()
  })

  it('records the aggregated result and advances to the next pending item', () => {
    const { setSessionName, addItem, createSession, finalizeItem } =
      useSessionStore.getState()
    setSessionName('Sprint 14')
    addItem('First')
    addItem('Second')
    createSession()
    const [first, second] = useSessionStore.getState().items

    const result = finalizeItem(first!.id, 2, 5, 8)
    expect(result.ok).toBe(true)

    const state = useSessionStore.getState()
    expect(state.items[0]!.finalResult).toMatchObject({ min: 2, expected: 5, max: 8 })
    expect(state.activeItemId).toBe(second!.id)
  })

  it('clears activeItemId once every item is finalized', () => {
    const { setSessionName, addItem, createSession, finalizeItem } =
      useSessionStore.getState()
    setSessionName('Sprint 14')
    addItem('Only item')
    createSession()
    const id = useSessionStore.getState().items[0]!.id

    finalizeItem(id, 2, 5, 8)
    expect(useSessionStore.getState().activeItemId).toBeNull()
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
