import { describe, expect, it } from 'vitest'
import {
  acceptRemoteEstimate,
  recordOwnSubmission,
  retryRoundPatch,
  upsertByParticipant,
} from './round'
import { estimateOf, finalizedItemOf, itemOf } from './testFixtures'
import type { LiveRound } from './types'

describe('upsertByParticipant', () => {
  it('appends a new participant', () => {
    const a = estimateOf('a')
    const b = estimateOf('b')
    expect(upsertByParticipant([a], b)).toEqual([a, b])
  })

  it('replaces an existing participant in place, keeping submission order', () => {
    const a = estimateOf('a', 1, 2, 3)
    const b = estimateOf('b')
    const a2 = estimateOf('a', 4, 5, 6)
    expect(upsertByParticipant([a, b], a2)).toEqual([a2, b])
  })

  it('does not mutate its input', () => {
    const list = [estimateOf('a')]
    upsertByParticipant(list, estimateOf('a', 4, 5, 6))
    expect(list).toEqual([estimateOf('a')])
  })
})

describe('retryRoundPatch', () => {
  it('clears the round and bumps the round number', () => {
    const item = finalizedItemOf({
      revealed: true,
      round: 2,
      submissions: [estimateOf('a')],
    })
    expect(retryRoundPatch(item)).toEqual({
      submissions: [],
      revealed: false,
      round: 3,
      finalResult: null,
    })
  })
})

describe('acceptRemoteEstimate', () => {
  const active = itemOf({ id: 'i1', round: 1, submissions: [estimateOf('a')] })
  const incoming = estimateOf('b')

  it('records a submission for the active item and round', () => {
    expect(acceptRemoteEstimate(active, 'i1', incoming, 1)).toEqual([
      estimateOf('a'),
      incoming,
    ])
  })

  it('replaces the same participant resubmitting', () => {
    const revised = estimateOf('a', 7, 8, 9)
    expect(acceptRemoteEstimate(active, 'i1', revised, 1)).toEqual([revised])
  })

  it('drops an estimate when there is no active item', () => {
    expect(acceptRemoteEstimate(undefined, 'i1', incoming, 1)).toBeNull()
  })

  it('drops an estimate for a different item (a straggler for a finalized item)', () => {
    expect(acceptRemoteEstimate(active, 'other', incoming, 1)).toBeNull()
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

  it('drops a stale-round estimate (an in-flight send from before a Retry)', () => {
    expect(acceptRemoteEstimate(active, 'i1', incoming, 0)).toBeNull()
    expect(acceptRemoteEstimate(active, 'i1', incoming, 2)).toBeNull()
  })

  it('drops an estimate once the round is revealed', () => {
    expect(
      acceptRemoteEstimate({ ...active, revealed: true }, 'i1', incoming, 1),
    ).toBeNull()
  })

  it('drops an estimate for a finalized item', () => {
    expect(
      acceptRemoteEstimate(finalizedItemOf({ id: 'i1', round: 1 }), 'i1', incoming, 1),
    ).toBeNull()
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
  }

  it('is a no-op without an active round', () => {
    expect(recordOwnSubmission(null, estimateOf('me'))).toBeNull()
  })

  it('records the estimate as the own submission and in the list', () => {
    const mine = estimateOf('me')
    expect(recordOwnSubmission(round, mine)).toEqual({
      ...round,
      mySubmission: mine,
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
