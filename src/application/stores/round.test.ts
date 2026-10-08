import { beforeEach, describe, expect, it } from 'vitest'
import { aggregateEstimates, createEstimate, type Estimate } from '../../domain/estimate'
import { useRoundStore } from './round'
import { useSessionStore } from './session'
import { useConnectionStore } from './connection'
import type { Item } from '../../domain/types'

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
  it('records the given aggregate as the item final result', () => {
    const { addItem } = useSessionStore.getState()
    addItem('First')
    addItem('Second')
    const [first] = useSessionStore.getState().items

    useRoundStore
      .getState()
      .finalizeItem(
        first!.id,
        aggregateEstimates([makeEstimate({ best: 2, likely: 5, worst: 8 })]),
      )

    const state = useSessionStore.getState()
    expect(state.items[0]!.finalResult).toMatchObject({ min: 2, expected: 5, max: 8 })
    expect(state.items[1]!.finalResult).toBeNull()
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

  it('records the estimate and its values as the local submission', () => {
    useRoundStore
      .getState()
      .submitEstimate(
        makeEstimate({ participantId: 'me-123', best: 3, likely: 5, worst: 8 }),
      )

    const round = useRoundStore.getState().liveRound!
    expect(round.mySubmission).toMatchObject({ best: 3, likely: 5, worst: 8 })
    expect(round.submissions).toHaveLength(1)
    expect(round.submissions[0]).toMatchObject({ participantId: 'me-123', best: 3 })
  })

  it('replaces the earlier submission on a revise', () => {
    useRoundStore
      .getState()
      .submitEstimate(
        makeEstimate({ participantId: 'me-123', best: 3, likely: 5, worst: 8 }),
      )
    useRoundStore
      .getState()
      .submitEstimate(
        makeEstimate({ participantId: 'me-123', best: 3, likely: 5, worst: 13 }),
      )

    const round = useRoundStore.getState().liveRound!
    expect(round.submissions).toHaveLength(1)
    expect(round.mySubmission).toMatchObject({ best: 3, likely: 5, worst: 13 })
  })

  it('is a no-op when there is no active round', () => {
    useRoundStore.setState({ liveRound: null })
    useRoundStore.getState().submitEstimate(makeEstimate())
    expect(useRoundStore.getState().liveRound).toBeNull()
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
