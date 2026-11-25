import { describe, expect, it } from 'vitest'
import {
  isNewRound,
  acceptRemoteEstimate,
  adoptSnapshot,
  recordOwnSubmission,
  upsertByParticipant,
} from './round'
import { aggregateOf, estimateOf, itemOf } from './testFixtures'
import type { LiveRound, SessionSnapshot } from './types'

describe('upsertByParticipant', () => {
  it('does not mutate its input', () => {
    const list = [estimateOf('a')]
    upsertByParticipant(list, estimateOf('a', 4, 5, 6))
    expect(list).toEqual([estimateOf('a')])
  })
})

describe('isNewRound', () => {
  it('is a new round when the same item moved to another round', () => {
    expect(isNewRound({ itemId: 'a', round: 0 }, { itemId: 'a', round: 1 })).toBe(true)
  })

  it('is not a new round for the same round, or for another item', () => {
    expect(isNewRound({ itemId: 'a', round: 1 }, { itemId: 'a', round: 1 })).toBe(false)
    expect(isNewRound({ itemId: 'a', round: 0 }, { itemId: 'b', round: 1 })).toBe(false)
  })
})

describe('acceptRemoteEstimate', () => {
  const active = itemOf({ id: 'i1', round: 1, submissions: [estimateOf('a')] })
  const incoming = estimateOf('b')

  it('drops an estimate when there is no active item', () => {
    expect(acceptRemoteEstimate(undefined, 'i1', incoming, 1)).toBeNull()
  })

  it('records a legacy peer estimate with an empty itemId against the active round', () => {
    expect(acceptRemoteEstimate(active, '', incoming, 1)).toEqual([
      estimateOf('a'),
      incoming,
    ])
  })

  it('records an estimate from an older build that sends no round', () => {
    expect(acceptRemoteEstimate(active, 'i1', incoming)).toEqual([
      estimateOf('a'),
      incoming,
    ])
  })
})

describe('recordOwnSubmission', () => {
  const round: LiveRound = {
    item: { id: 'i1', title: 'T', description: '' },
    submissions: [],
    revealed: false,
    round: 0,
    roster: [],
    mySubmission: null,
    finalResult: null,
  }

  it('is a no-op without an active round', () => {
    expect(recordOwnSubmission(null, estimateOf('me'))).toBeNull()
  })

  it('records the estimate as the own submission and in the list', () => {
    const mine = estimateOf('me')
    expect(recordOwnSubmission(round, mine)).toEqual({
      ...round,
      mySubmission: mine,
      finalResult: null,
      submissions: [mine],
    })
  })

  it('replaces the previous own submission when revising', () => {
    const first = estimateOf('me', 1, 2, 3)
    const revised = estimateOf('me', 4, 5, 6)
    const after = recordOwnSubmission(recordOwnSubmission(round, first), revised)
    expect(after?.mySubmission).toEqual(revised)
    expect(after?.submissions).toEqual([revised])
  })
})

const currentItem = { id: 'i1', title: 'Retry queue', description: 'backoff' }

function snapshotOf(overrides: Partial<SessionSnapshot> = {}): SessionSnapshot {
  return {
    currentItem,
    sessionName: 'Sprint 42',
    unit: 'weeks',
    revealed: false,
    round: 0,
    roster: [{ participantId: 'a', submitted: true, connected: true }],
    submissions: [],
    finalizedItemIds: [],
    finalResult: null,
    ...overrides,
  }
}

function roundOf(overrides: Partial<LiveRound> = {}): LiveRound {
  return {
    item: currentItem,
    submissions: [],
    revealed: false,
    round: 0,
    roster: [],
    mySubmission: null,
    finalResult: null,
    ...overrides,
  }
}

describe('adoptSnapshot', () => {
  it('clears the final result when a reopen snapshot arrives', () => {
    const next = adoptSnapshot(
      roundOf({ finalResult: aggregateOf(2, 3, 6) }),
      snapshotOf({ round: 1, finalResult: null }),
    )
    expect(next?.finalResult).toBeNull()
  })

  it('holds no estimate values pre-reveal, whatever the snapshot carries', () => {
    const next = adoptSnapshot(
      null,
      snapshotOf({ revealed: false, submissions: [estimateOf('a')] }),
    )
    expect(next?.submissions).toEqual([])
  })

  it('drops the own submission when a retry was missed along with the reveal', () => {
    const previous = roundOf({
      revealed: false,
      round: 0,
      mySubmission: estimateOf('me'),
      finalResult: null,
    })
    const next = adoptSnapshot(previous, snapshotOf({ revealed: true, round: 2 }))
    expect(next).toMatchObject({ revealed: true, round: 2, mySubmission: null })
  })
})
