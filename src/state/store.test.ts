import { beforeEach, describe, expect, it } from 'vitest'
import { createEstimate, type Estimate } from '../calc'
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
    participantId: '',
    connectionStatus: 'idle',
    peerCount: 0,
    liveRound: null,
  })
}

function makeEstimate(overrides: Partial<Estimate> = {}): Estimate {
  const result = createEstimate({
    participantId: 'p1',
    best: 2,
    likely: 4,
    worst: 8,
    ...overrides,
  })
  if (!result.ok) throw new Error('test fixture invalid')
  return result.value
}

const snapshotItem = { id: 'item-1', title: 'Retry queue', description: 'backoff' }

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
    useSessionStore.getState().applySyncState({
      currentItem: snapshotItem,
      unit: 'weeks',
      submissions: [],
      finalizedItemIds: [],
    })
    expect(useSessionStore.getState().unit).toBe('weeks')

    useSessionStore.getState().leaveLiveSession()

    expect(useSessionStore.getState()).toMatchObject({
      mode: 'manual',
      role: 'facilitator',
      sessionId: null,
      myName: '',
      participantId: '',
      connectionStatus: 'idle',
      peerCount: 0,
      liveRound: null,
      currentScreen: 'mode-select',
      // a unit inherited from the facilitator must not leak past leave
      unit: 'days',
    })
  })

  it('assigns a stable participant id on join', () => {
    useSessionStore.getState().joinLiveSession('K7F9Q2', 'Sam')
    expect(useSessionStore.getState().participantId).toMatch(/[0-9a-f-]{36}/)
  })
})

describe('applySyncState', () => {
  it('creates a live round from the facilitator snapshot and adopts its unit', () => {
    useSessionStore.getState().applySyncState({
      currentItem: snapshotItem,
      unit: 'weeks',
      submissions: [],
      finalizedItemIds: [],
    })

    const round = useSessionStore.getState().liveRound
    expect(round).toMatchObject({
      item: snapshotItem,
      revealed: false,
      mySubmission: null,
    })
    expect(useSessionStore.getState().unit).toBe('weeks')
  })

  it('clears the live round when the facilitator has no active item', () => {
    useSessionStore.setState({
      liveRound: {
        item: snapshotItem,
        submissions: [],
        revealed: true,
        mySubmission: null,
      },
    })

    useSessionStore.getState().applySyncState({
      currentItem: null,
      unit: 'hours',
      submissions: [],
      finalizedItemIds: [],
    })

    expect(useSessionStore.getState().liveRound).toBeNull()
    expect(useSessionStore.getState().unit).toBe('hours')
  })

  it('preserves own submission and reveal flag across a same-item snapshot', () => {
    useSessionStore.setState({
      liveRound: {
        item: snapshotItem,
        submissions: [makeEstimate()],
        revealed: true,
        mySubmission: { best: 2, likely: 4, worst: 8 },
      },
    })

    useSessionStore.getState().applySyncState({
      currentItem: snapshotItem,
      unit: 'days',
      submissions: [],
      finalizedItemIds: [],
    })

    const round = useSessionStore.getState().liveRound
    expect(round?.revealed).toBe(true)
    expect(round?.mySubmission).toEqual({ best: 2, likely: 4, worst: 8 })
    expect(round?.submissions).toHaveLength(1)
  })

  it('resets round-local state when the active item changes', () => {
    useSessionStore.setState({
      liveRound: {
        item: snapshotItem,
        submissions: [makeEstimate()],
        revealed: true,
        mySubmission: { best: 2, likely: 4, worst: 8 },
      },
    })

    const nextItem = { id: 'item-2', title: 'Next', description: '' }
    useSessionStore.getState().applySyncState({
      currentItem: nextItem,
      unit: 'days',
      submissions: [],
      finalizedItemIds: [],
    })

    expect(useSessionStore.getState().liveRound).toMatchObject({
      item: nextItem,
      submissions: [],
      revealed: false,
      mySubmission: null,
    })
  })
})

describe('applyRemoteEstimate', () => {
  it('upserts an incoming submission keyed by participantId', () => {
    useSessionStore.setState({
      liveRound: {
        item: snapshotItem,
        submissions: [],
        revealed: false,
        mySubmission: null,
      },
    })

    useSessionStore.getState().applyRemoteEstimate(makeEstimate({ participantId: 'a' }))
    useSessionStore
      .getState()
      .applyRemoteEstimate(makeEstimate({ participantId: 'a', worst: 9 }))
    useSessionStore.getState().applyRemoteEstimate(makeEstimate({ participantId: 'b' }))

    const submissions = useSessionStore.getState().liveRound!.submissions
    expect(submissions).toHaveLength(2)
    expect(submissions[0]).toMatchObject({ participantId: 'a', worst: 9 })
  })

  it('is a no-op when there is no live round', () => {
    useSessionStore.getState().applyRemoteEstimate(makeEstimate())
    expect(useSessionStore.getState().liveRound).toBeNull()
  })
})

describe('applyReveal', () => {
  it('marks the round revealed only when the item id matches', () => {
    useSessionStore.setState({
      liveRound: {
        item: snapshotItem,
        submissions: [],
        revealed: false,
        mySubmission: null,
      },
    })

    useSessionStore.getState().applyReveal('other-item')
    expect(useSessionStore.getState().liveRound!.revealed).toBe(false)

    useSessionStore.getState().applyReveal('item-1')
    expect(useSessionStore.getState().liveRound!.revealed).toBe(true)
  })
})

describe('submitEstimate', () => {
  beforeEach(() => {
    useSessionStore.setState({
      participantId: 'me-123',
      liveRound: {
        item: snapshotItem,
        submissions: [],
        revealed: false,
        mySubmission: null,
      },
    })
  })

  it('records a valid estimate under the local participant id', () => {
    const result = useSessionStore.getState().submitEstimate(3, 5, 8)

    expect(result.ok).toBe(true)
    const round = useSessionStore.getState().liveRound!
    expect(round.mySubmission).toEqual({ best: 3, likely: 5, worst: 8 })
    expect(round.submissions).toHaveLength(1)
    expect(round.submissions[0]).toMatchObject({ participantId: 'me-123', best: 3 })
  })

  it('replaces the earlier submission on a revise', () => {
    useSessionStore.getState().submitEstimate(3, 5, 8)
    useSessionStore.getState().submitEstimate(3, 5, 13)

    const round = useSessionStore.getState().liveRound!
    expect(round.submissions).toHaveLength(1)
    expect(round.mySubmission).toEqual({ best: 3, likely: 5, worst: 13 })
  })

  it('rejects a descending estimate without recording it', () => {
    const result = useSessionStore.getState().submitEstimate(10, 5, 3)

    expect(result).toMatchObject({ ok: false })
    expect(useSessionStore.getState().liveRound!.mySubmission).toBeNull()
  })

  it('fails when there is no active round', () => {
    useSessionStore.setState({ liveRound: null })
    const result = useSessionStore.getState().submitEstimate(3, 5, 8)
    expect(result).toMatchObject({ ok: false })
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
