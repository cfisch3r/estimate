import { beforeEach, describe, expect, it } from 'vitest'
import { createEstimate, type Estimate } from '../../estimate'
import { useRoundStore } from './round'
import { useSessionStore } from './session'
import { useConnectionStore } from './connection'
import type { Item } from './types'

function resetStore() {
  useSessionStore.setState({
    sessionName: '',
    unit: 'days',
    items: [],
    activeItemId: null,
  })
  useConnectionStore.setState({
    mode: 'manual',
    role: 'facilitator',
    participantId: '',
  })
  useRoundStore.setState({ liveRound: null })
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

describe('finalizeItem', () => {
  it('rejects an invalid estimate and leaves the item unfinalized', () => {
    const { addItem, selectItem } = useSessionStore.getState()
    addItem('Only item')
    const id = useSessionStore.getState().items[0]!.id
    selectItem(id)

    const result = useRoundStore.getState().finalizeItem(id, 10, 5, 3) // descending, invalid
    expect(result.ok).toBe(false)
    expect(useSessionStore.getState().items[0]!.finalResult).toBeNull()
  })

  it('records the aggregated result and leaves navigation to the caller', () => {
    const { addItem } = useSessionStore.getState()
    addItem('First')
    addItem('Second')
    const [first] = useSessionStore.getState().items

    const result = useRoundStore.getState().finalizeItem(first!.id, 2, 5, 8)
    expect(result.ok).toBe(true)

    const state = useSessionStore.getState()
    expect(state.items[0]!.finalResult).toMatchObject({ min: 2, expected: 5, max: 8 })
  })
})

describe('applySyncState', () => {
  it('creates a live round from the facilitator snapshot and adopts its unit', () => {
    useRoundStore.getState().applySyncState({
      currentItem: snapshotItem,
      sessionName: '',
      unit: 'weeks',
      revealed: false,
      round: 0,
      roster: [
        { participantId: 'a', submitted: false, connected: true },
        { participantId: 'b', submitted: true, connected: true },
      ],
      submissions: [],
      finalizedItemIds: [],
    })

    const round = useRoundStore.getState().liveRound
    expect(round).toMatchObject({
      item: snapshotItem,
      revealed: false,
      mySubmission: null,
    })
    expect(useSessionStore.getState().unit).toBe('weeks')
  })

  it('clears the live round when the facilitator has no active item', () => {
    useRoundStore.setState({
      liveRound: {
        item: snapshotItem,
        submissions: [],
        revealed: true,
        round: 0,
        roster: [],
        mySubmission: null,
      },
    })

    useRoundStore.getState().applySyncState({
      currentItem: null,
      sessionName: '',
      unit: 'hours',
      revealed: false,
      round: 0,
      roster: [],
      submissions: [],
      finalizedItemIds: [],
    })

    expect(useRoundStore.getState().liveRound).toBeNull()
    expect(useSessionStore.getState().unit).toBe('hours')
  })

  it('holds no estimate values pre-reveal, even across a same-item snapshot', () => {
    useRoundStore.setState({
      liveRound: {
        item: snapshotItem,
        submissions: [],
        revealed: false,
        round: 0,
        roster: [],
        mySubmission: { best: 2, likely: 4, worst: 8 },
      },
    })

    useRoundStore.getState().applySyncState({
      currentItem: snapshotItem,
      sessionName: '',
      unit: 'days',
      revealed: false,
      round: 0,
      roster: [
        { participantId: 'a', submitted: false, connected: true },
        { participantId: 'b', submitted: true, connected: true },
      ],
      submissions: [],
      finalizedItemIds: [],
    })

    const round = useRoundStore.getState().liveRound
    expect(round?.mySubmission).toEqual({ best: 2, likely: 4, worst: 8 })
    expect(round?.submissions).toEqual([])
  })

  it('takes the frozen submission set from a revealed snapshot', () => {
    useRoundStore.setState({
      liveRound: {
        item: snapshotItem,
        submissions: [],
        revealed: false,
        round: 0,
        roster: [],
        mySubmission: null,
      },
    })

    useRoundStore.getState().applySyncState({
      currentItem: snapshotItem,
      sessionName: '',
      unit: 'days',
      revealed: true,
      round: 0,
      roster: [
        { participantId: 'a', submitted: false, connected: true },
        { participantId: 'b', submitted: true, connected: true },
      ],
      submissions: [
        { participantId: 'a', best: 2, likely: 4, worst: 8 },
        { participantId: 'b', best: 3, likely: 5, worst: 9 },
      ],
      finalizedItemIds: [],
    })

    const round = useRoundStore.getState().liveRound
    expect(round?.revealed).toBe(true)
    expect(round?.submissions.map((s) => s.participantId)).toEqual(['a', 'b'])
  })

  it('drops stale round-local state when a same-item snapshot bumps the round (Retry)', () => {
    useRoundStore.setState({
      liveRound: {
        item: snapshotItem,
        submissions: [makeEstimate()],
        revealed: true,
        round: 0,
        roster: [],
        mySubmission: { best: 2, likely: 4, worst: 8 },
      },
    })

    useRoundStore.getState().applySyncState({
      currentItem: snapshotItem,
      sessionName: '',
      unit: 'days',
      revealed: false,
      round: 1,
      roster: [],
      submissions: [],
      finalizedItemIds: [],
    })

    const round = useRoundStore.getState().liveRound
    expect(round?.revealed).toBe(false)
    expect(round?.round).toBe(1)
    expect(round?.submissions).toEqual([])
    expect(round?.mySubmission).toBeNull()
  })

  it('drops stale round-local state on a round bump even without ever seeing the Reveal (missed both events)', () => {
    useRoundStore.setState({
      liveRound: {
        item: snapshotItem,
        submissions: [],
        revealed: false,
        round: 0,
        roster: [],
        mySubmission: { best: 2, likely: 4, worst: 8 },
      },
    })

    useRoundStore.getState().applySyncState({
      currentItem: snapshotItem,
      sessionName: '',
      unit: 'days',
      revealed: false,
      round: 1,
      roster: [],
      submissions: [],
      finalizedItemIds: [],
    })

    const round = useRoundStore.getState().liveRound
    expect(round?.submissions).toEqual([])
    expect(round?.mySubmission).toBeNull()
  })

  it('adopts revealed:true from the snapshot for a peer with no prior round', () => {
    useRoundStore.setState({ liveRound: null })

    useRoundStore.getState().applySyncState({
      currentItem: snapshotItem,
      sessionName: '',
      unit: 'days',
      revealed: true,
      round: 0,
      roster: [
        { participantId: 'a', submitted: false, connected: true },
        { participantId: 'b', submitted: true, connected: true },
      ],
      submissions: [makeEstimate({ participantId: 'a' })],
      finalizedItemIds: [],
    })

    expect(useRoundStore.getState().liveRound).toMatchObject({
      item: snapshotItem,
      revealed: true,
    })
  })

  it('resets round-local state when the active item changes', () => {
    useRoundStore.setState({
      liveRound: {
        item: snapshotItem,
        submissions: [makeEstimate()],
        revealed: true,
        round: 0,
        roster: [],
        mySubmission: { best: 2, likely: 4, worst: 8 },
      },
    })

    const nextItem = { id: 'item-2', title: 'Next', description: '' }
    useRoundStore.getState().applySyncState({
      currentItem: nextItem,
      sessionName: '',
      unit: 'days',
      revealed: false,
      round: 0,
      roster: [],
      submissions: [],
      finalizedItemIds: [],
    })

    expect(useRoundStore.getState().liveRound).toMatchObject({
      item: nextItem,
      submissions: [],
      revealed: false,
      mySubmission: null,
    })
  })
})

describe('applyRemoteEstimate', () => {
  function seedActiveItem(overrides: Partial<Item> = {}) {
    useConnectionStore.setState({ role: 'facilitator' })
    useSessionStore.setState({
      items: [
        {
          id: 'i1',
          title: 'Retry queue',
          description: '',
          notes: '',
          finalResult: null,
          submissions: [],
          revealed: false,
          round: 0,
          ...overrides,
        },
      ],
      activeItemId: 'i1',
    })
  }

  it('records incoming submissions on the active item, upserting by participantId', () => {
    seedActiveItem()
    const round = useRoundStore.getState()

    round.applyRemoteEstimate('i1', makeEstimate({ participantId: 'a' }))
    round.applyRemoteEstimate('i1', makeEstimate({ participantId: 'a', worst: 9 }))
    round.applyRemoteEstimate('i1', makeEstimate({ participantId: 'b' }))

    const { submissions } = useSessionStore.getState().items[0]!
    expect(submissions).toHaveLength(2)
    expect(submissions[0]).toMatchObject({ participantId: 'a', worst: 9 })
  })

  it('drops a straggler submission whose item is no longer the active one', () => {
    seedActiveItem()
    useRoundStore
      .getState()
      .applyRemoteEstimate('a-finalized-item', makeEstimate({ participantId: 'a' }))
    expect(useSessionStore.getState().items[0]!.submissions).toHaveLength(0)
  })

  it('ignores submissions once the item is revealed or finalized', () => {
    seedActiveItem({ revealed: true })
    useRoundStore
      .getState()
      .applyRemoteEstimate('i1', makeEstimate({ participantId: 'a' }))
    expect(useSessionStore.getState().items[0]!.submissions).toHaveLength(0)
  })

  it('is a no-op when no item is active', () => {
    useSessionStore.setState({ items: [], activeItemId: null })
    useRoundStore.getState().applyRemoteEstimate('i1', makeEstimate())
    expect(useSessionStore.getState().items).toEqual([])
  })

  it('drops a submission whose round does not match the active item’s round (stale peer-join re-broadcast)', () => {
    seedActiveItem({ round: 2 })
    useRoundStore
      .getState()
      .applyRemoteEstimate('i1', makeEstimate({ participantId: 'a' }), 1)
    expect(useSessionStore.getState().items[0]!.submissions).toHaveLength(0)
  })

  it('records a submission whose round matches the active item’s round', () => {
    seedActiveItem({ round: 2 })
    useRoundStore
      .getState()
      .applyRemoteEstimate('i1', makeEstimate({ participantId: 'a' }), 2)
    expect(useSessionStore.getState().items[0]!.submissions).toHaveLength(1)
  })

  it('records a submission with no round at all (older build) rather than treating it as stale', () => {
    seedActiveItem({ round: 2 })
    useRoundStore
      .getState()
      .applyRemoteEstimate('i1', makeEstimate({ participantId: 'a' }))
    expect(useSessionStore.getState().items[0]!.submissions).toHaveLength(1)
  })
})

describe('revealRound / retryRound / finalizeLiveItem (facilitator)', () => {
  function seed(overrides: Partial<Item> = {}) {
    useConnectionStore.setState({ role: 'facilitator' })
    useSessionStore.setState({
      items: [
        {
          id: 'i1',
          title: 'Retry queue',
          description: '',
          notes: '',
          finalResult: null,
          submissions: [],
          revealed: false,
          round: 0,
          ...overrides,
        },
        {
          id: 'i2',
          title: 'Next',
          description: '',
          notes: '',
          finalResult: null,
          submissions: [],
          revealed: false,
          round: 0,
        },
      ],
      activeItemId: 'i1',
    })
  }

  it('revealRound flips the flag on the target item', () => {
    seed()
    useRoundStore.getState().revealRound('i1')
    expect(useSessionStore.getState().items[0]!.revealed).toBe(true)
  })

  it('retryRound clears submissions and the revealed flag', () => {
    seed({ revealed: true, submissions: [makeEstimate({ participantId: 'a' })] })
    useRoundStore.getState().retryRound('i1')
    expect(useSessionStore.getState().items[0]!).toMatchObject({
      revealed: false,
      submissions: [],
    })
  })

  it('retryRound bumps the round counter', () => {
    seed({ round: 3 })
    useRoundStore.getState().retryRound('i1')
    useRoundStore.getState().retryRound('i1')
    expect(useSessionStore.getState().items[0]!.round).toBe(5)
  })

  it('retryRound clears a finalized item’s recorded range (reopen)', () => {
    const finalized = { min: 1, expected: 2, max: 3, ci90: 3 }
    seed({ revealed: true, finalResult: finalized })

    // retryRound also backs the confirm-guarded "Reopen item" control (#36) for an
    // already-finalized item, so the stale range must not survive the reopen.
    useRoundStore.getState().retryRound('i1')

    expect(useSessionStore.getState().items[0]!.finalResult).toBeNull()
  })

  it('finalizeLiveItem aggregates submissions and leaves navigation to the caller', () => {
    seed({
      revealed: true,
      submissions: [
        makeEstimate({ participantId: 'a', best: 2, likely: 4, worst: 8 }),
        makeEstimate({ participantId: 'b', best: 4, likely: 6, worst: 12 }),
      ],
    })

    const result = useRoundStore.getState().finalizeLiveItem('i1')

    expect(result.ok).toBe(true)
    expect(useSessionStore.getState().items[0]!.finalResult).toMatchObject({
      min: 2,
      expected: 5,
      max: 12,
    })
  })

  it('finalizeLiveItem fails when no submissions have arrived', () => {
    seed()
    const result = useRoundStore.getState().finalizeLiveItem('i1')
    expect(result).toMatchObject({ ok: false })
    expect(useSessionStore.getState().items[0]!.finalResult).toBeNull()
  })
})

describe('submitEstimate', () => {
  beforeEach(() => {
    useConnectionStore.setState({ participantId: 'me-123' })
    useRoundStore.setState({
      liveRound: {
        item: snapshotItem,
        submissions: [],
        revealed: false,
        round: 0,
        roster: [],
        mySubmission: null,
      },
    })
  })

  it('records a valid estimate under the local participant id', () => {
    const result = useRoundStore.getState().submitEstimate(3, 5, 8)

    expect(result.ok).toBe(true)
    const round = useRoundStore.getState().liveRound!
    expect(round.mySubmission).toEqual({ best: 3, likely: 5, worst: 8 })
    expect(round.submissions).toHaveLength(1)
    expect(round.submissions[0]).toMatchObject({ participantId: 'me-123', best: 3 })
  })

  it('replaces the earlier submission on a revise', () => {
    useRoundStore.getState().submitEstimate(3, 5, 8)
    useRoundStore.getState().submitEstimate(3, 5, 13)

    const round = useRoundStore.getState().liveRound!
    expect(round.submissions).toHaveLength(1)
    expect(round.mySubmission).toEqual({ best: 3, likely: 5, worst: 13 })
  })

  it('rejects a descending estimate without recording it', () => {
    const result = useRoundStore.getState().submitEstimate(10, 5, 3)

    expect(result).toMatchObject({ ok: false })
    expect(useRoundStore.getState().liveRound!.mySubmission).toBeNull()
  })

  it('fails when there is no active round', () => {
    useRoundStore.setState({ liveRound: null })
    const result = useRoundStore.getState().submitEstimate(3, 5, 8)
    expect(result).toMatchObject({ ok: false })
  })
})

describe('clearRound', () => {
  it('drops the participant-side round view', () => {
    useRoundStore.setState({
      liveRound: {
        item: snapshotItem,
        submissions: [],
        revealed: false,
        round: 0,
        roster: [],
        mySubmission: null,
      },
    })

    useRoundStore.getState().clearRound()

    expect(useRoundStore.getState().liveRound).toBeNull()
  })
})
