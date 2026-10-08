import { describe, expect, it } from 'vitest'
import {
  buildSessionSnapshot,
  sessionFieldsFromSnapshot,
  snapshotChangeKey,
} from './snapshot'
import { estimateOf, finalizedItemOf, itemOf } from './testFixtures'
import type { SessionSnapshot } from './types'

const base = {
  sessionName: 'Sprint 42',
  unit: 'days' as const,
  participantNames: { facilitator: 'Facilitator', a: 'Ada' },
  connectedParticipantIds: new Set(['a']),
}

describe('buildSessionSnapshot', () => {
  it('has no current item when nothing is active', () => {
    const snapshot = buildSessionSnapshot({
      ...base,
      items: [finalizedItemOf({ id: 'done' })],
      activeItemId: null,
    })
    expect(snapshot).toMatchObject({
      currentItem: null,
      revealed: false,
      round: 0,
      submissions: [],
      sessionName: 'Sprint 42',
      unit: 'days',
      finalizedItemIds: ['done'],
    })
    expect(snapshot.roster).toEqual([
      { participantId: 'a', submitted: false, connected: true },
    ])
  })

  it('withholds estimate values until the round is revealed, exposing only the roster', () => {
    const active = itemOf({
      id: 'x',
      title: 'T',
      description: 'D',
      round: 3,
      submissions: [estimateOf('a')],
    })
    const snapshot = buildSessionSnapshot({ ...base, items: [active], activeItemId: 'x' })
    expect(snapshot.currentItem).toEqual({ id: 'x', title: 'T', description: 'D' })
    expect(snapshot.round).toBe(3)
    expect(snapshot.submissions).toEqual([])
    expect(snapshot.roster).toEqual([
      { participantId: 'a', submitted: true, connected: true },
    ])
  })

  it('includes the frozen submissions once revealed', () => {
    const submissions = [estimateOf('a')]
    const snapshot = buildSessionSnapshot({
      ...base,
      items: [itemOf({ id: 'x', revealed: true, submissions })],
      activeItemId: 'x',
    })
    expect(snapshot.revealed).toBe(true)
    expect(snapshot.submissions).toEqual(submissions)
  })
})

describe('snapshotChangeKey', () => {
  it('ignores the frozen submission values but tracks everything else', () => {
    const snapshot = buildSessionSnapshot({
      ...base,
      items: [itemOf({ id: 'x', revealed: true, submissions: [estimateOf('a')] })],
      activeItemId: 'x',
    })
    expect(snapshotChangeKey({ ...snapshot, submissions: [] })).toBe(
      snapshotChangeKey(snapshot),
    )
    expect(snapshotChangeKey({ ...snapshot, round: snapshot.round + 1 })).not.toBe(
      snapshotChangeKey(snapshot),
    )
  })
})

function snapshotOf(): SessionSnapshot {
  return {
    currentItem: null,
    sessionName: 'Sprint 42',
    unit: 'weeks',
    revealed: false,
    round: 0,
    roster: [],
    submissions: [],
    finalizedItemIds: [],
  }
}

describe('sessionFieldsFromSnapshot', () => {
  it('lets a participant adopt the facilitator name and unit', () => {
    expect(sessionFieldsFromSnapshot('participant', snapshotOf())).toEqual({
      sessionName: 'Sprint 42',
      unit: 'weeks',
    })
  })

  it('never lets an echoed snapshot overwrite the facilitator own name', () => {
    expect(sessionFieldsFromSnapshot('facilitator', snapshotOf())).toEqual({
      unit: 'weeks',
    })
  })
})
