import { beforeEach, describe, expect, it } from 'vitest'
import { useSessionStore } from './store'

function resetStore() {
  useSessionStore.setState({
    currentScreen: 'mode-select',
    sessionName: '',
    unit: 'days',
    items: [],
    activeItemId: null,
    mode: 'manual',
    role: 'facilitator',
    sessionId: null,
    myName: '',
    connectionStatus: 'idle',
    peerCount: 0,
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

describe('startSingleUser', () => {
  it('enters the workspace with no items and nothing selected', () => {
    useSessionStore.getState().startSingleUser()
    const state = useSessionStore.getState()
    expect(state.currentScreen).toBe('workspace')
    expect(state.activeItemId).toBeNull()
  })

  it('selects the first pending item when items already exist', () => {
    const { addItem, startSingleUser } = useSessionStore.getState()
    addItem('First item')
    addItem('Second item')
    startSingleUser()
    const state = useSessionStore.getState()
    expect(state.currentScreen).toBe('workspace')
    expect(state.activeItemId).toBe(state.items[0]?.id)
  })
})

describe('finalizeItem', () => {
  it('rejects an invalid estimate and leaves the item unfinalized', () => {
    const { addItem, startSingleUser, finalizeItem } = useSessionStore.getState()
    addItem('Only item')
    startSingleUser()
    const id = useSessionStore.getState().items[0]!.id

    const result = finalizeItem(id, 10, 5, 3) // descending, invalid
    expect(result.ok).toBe(false)
    expect(useSessionStore.getState().items[0]!.finalResult).toBeNull()
  })

  it('records the aggregated result and advances to the next pending item', () => {
    const { addItem, startSingleUser, finalizeItem } = useSessionStore.getState()
    addItem('First')
    addItem('Second')
    startSingleUser()
    const [first, second] = useSessionStore.getState().items

    const result = finalizeItem(first!.id, 2, 5, 8)
    expect(result.ok).toBe(true)

    const state = useSessionStore.getState()
    expect(state.items[0]!.finalResult).toMatchObject({ min: 2, expected: 5, max: 8 })
    expect(state.activeItemId).toBe(second!.id)
  })

  it('clears activeItemId once every item is finalized', () => {
    const { addItem, startSingleUser, finalizeItem } = useSessionStore.getState()
    addItem('Only item')
    startSingleUser()
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

describe('startCollaborative', () => {
  it('enters a live facilitator session on the workspace with no items yet', () => {
    useSessionStore.getState().startCollaborative('K7F9Q2')

    const state = useSessionStore.getState()
    expect(state).toMatchObject({
      mode: 'live',
      role: 'facilitator',
      sessionId: 'K7F9Q2',
      connectionStatus: 'connecting',
      currentScreen: 'workspace',
    })
    expect(state.activeItemId).toBeNull()
  })

  it('selects the first pending item when items already exist', () => {
    useSessionStore.getState().addItem('First item')
    useSessionStore.getState().startCollaborative('K7F9Q2')

    const state = useSessionStore.getState()
    expect(state.activeItemId).toBe(state.items[0]?.id)
  })
})

describe('joinLiveSession', () => {
  it('ignores a blank code or blank name', () => {
    useSessionStore.getState().joinLiveSession('   ', 'Sam')
    useSessionStore.getState().joinLiveSession('K7F9Q2', '   ')
    expect(useSessionStore.getState().mode).toBe('manual')
    expect(useSessionStore.getState().currentScreen).toBe('mode-select')
  })

  it('enters a connecting participant session, normalising the code', () => {
    useSessionStore.getState().joinLiveSession('  k7f9q2 ', '  Sam Rivera  ')

    expect(useSessionStore.getState()).toMatchObject({
      mode: 'live',
      role: 'participant',
      sessionId: 'K7F9Q2',
      myName: 'Sam Rivera',
      connectionStatus: 'connecting',
      currentScreen: 'join',
    })
  })
})

describe('leaveLiveSession', () => {
  it('resets every live field and returns to the mode-select screen', () => {
    useSessionStore.getState().joinLiveSession('K7F9Q2', 'Sam')
    useSessionStore.getState().setConnectionStatus('connected')
    useSessionStore.getState().setPeerCount(3)

    useSessionStore.getState().leaveLiveSession()

    expect(useSessionStore.getState()).toMatchObject({
      mode: 'manual',
      role: 'facilitator',
      sessionId: null,
      myName: '',
      connectionStatus: 'idle',
      peerCount: 0,
      currentScreen: 'mode-select',
    })
  })
})

describe('connection mirrors', () => {
  it('setConnectionStatus and setPeerCount update just those fields', () => {
    useSessionStore.getState().setConnectionStatus('connected')
    useSessionStore.getState().setPeerCount(2)
    expect(useSessionStore.getState().connectionStatus).toBe('connected')
    expect(useSessionStore.getState().peerCount).toBe(2)
  })
})
