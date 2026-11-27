import { describe, expect, it } from 'vitest'
import { buildSessionSnapshot, snapshotChangeKey } from './snapshot'
import { aggregateOf, estimateOf, finalizedItemOf, itemOf } from './testFixtures'

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
      finalResult: null,
    })
    expect(snapshot.roster).toEqual([
      { participantId: 'a', submitted: false, connected: true },
    ])
  })

  it('has no final result while the active item is pending', () => {
    const snapshot = buildSessionSnapshot({
      ...base,
      items: [itemOf({ id: 'x' }), finalizedItemOf({ id: 'done' })],
      activeItemId: 'x',
    })
    expect(snapshot.finalResult).toBeNull()
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

  it('tracks a change of the final result alone', () => {
    const snapshot = buildSessionSnapshot({
      ...base,
      items: [itemOf({ id: 'x' })],
      activeItemId: 'x',
    })
    expect(
      snapshotChangeKey({ ...snapshot, finalResult: aggregateOf(2, 3, 6) }),
    ).not.toBe(snapshotChangeKey(snapshot))
  })
})
