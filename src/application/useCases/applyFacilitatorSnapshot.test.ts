import { beforeEach, describe, expect, it } from 'vitest'
import { createEstimate, type Estimate } from '../../domain/estimate'
import { useConnectionStore } from '../stores/connection'
import { useRoundStore } from '../stores/round'
import { useSessionStore } from '../stores/session'
import { applyFacilitatorSnapshot } from './applyFacilitatorSnapshot'

function mine(best: number, likely: number, worst: number): Estimate {
  const result = createEstimate({ participantId: 'me-123', best, likely, worst })
  if (!result.ok) throw new Error(result.error)
  return result.value
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

beforeEach(() => {
  useSessionStore.setState({
    sessionName: '',
    unit: 'days',
    items: [],
    activeItemId: null,
  })
  useConnectionStore.setState({ mode: 'manual', role: 'facilitator', participantId: '' })
  useRoundStore.setState({ liveRound: null })
})

describe('applyFacilitatorSnapshot', () => {
  it('creates a live round from the facilitator snapshot and adopts its unit', () => {
    applyFacilitatorSnapshot({
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

    applyFacilitatorSnapshot({
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
        mySubmission: mine(2, 4, 8),
      },
    })

    applyFacilitatorSnapshot({
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
    expect(round?.mySubmission).toMatchObject({ best: 2, likely: 4, worst: 8 })
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

    applyFacilitatorSnapshot({
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
        makeEstimate({ participantId: 'a', best: 2, likely: 4, worst: 8 }),
        makeEstimate({ participantId: 'b', best: 3, likely: 5, worst: 9 }),
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
        mySubmission: mine(2, 4, 8),
      },
    })

    applyFacilitatorSnapshot({
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
        mySubmission: mine(2, 4, 8),
      },
    })

    applyFacilitatorSnapshot({
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

    applyFacilitatorSnapshot({
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
        mySubmission: mine(2, 4, 8),
      },
    })

    const nextItem = { id: 'item-2', title: 'Next', description: '' }
    applyFacilitatorSnapshot({
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

describe('applyFacilitatorSnapshot: session fields', () => {
  const base = {
    currentItem: snapshotItem,
    unit: 'weeks' as const,
    revealed: false,
    round: 0,
    roster: [],
    submissions: [],
    finalizedItemIds: [],
  }

  it('lets a participant adopt the facilitator session name', () => {
    useConnectionStore.setState({ role: 'participant' })

    applyFacilitatorSnapshot({ ...base, sessionName: 'Sprint 42' })

    expect(useSessionStore.getState().sessionName).toBe('Sprint 42')
  })

  it('never lets a received snapshot overwrite the facilitator own session name', () => {
    useSessionStore.setState({ sessionName: 'Mine' })
    useConnectionStore.setState({ role: 'facilitator' })

    applyFacilitatorSnapshot({ ...base, sessionName: 'Echo' })

    expect(useSessionStore.getState().sessionName).toBe('Mine')
  })
})
