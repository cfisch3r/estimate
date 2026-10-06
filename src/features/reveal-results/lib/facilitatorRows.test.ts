import { describe, expect, it } from 'vitest'
import { createEstimate } from '../../../entities/session'
import type { Item } from '../../../entities/session'
import { buildFacilitatorRows } from './facilitatorRows'

function item(submissions: { participantId: string; best: number }[]): Item {
  return {
    id: 'i1',
    title: 'Item',
    description: '',
    notes: '',
    finalResult: null,
    submissions: submissions.map(({ participantId, best }) => {
      const result = createEstimate({
        participantId,
        best,
        likely: best + 1,
        worst: best + 3,
      })
      if (!result.ok) throw new Error(result.error)
      return result.value
    }),
    revealed: false,
    round: 0,
  }
}

describe('buildFacilitatorRows', () => {
  it('lists announced participants, using their names and no submission yet', () => {
    expect(buildFacilitatorRows(item([]), { a: 'Ada', facilitator: 'Host' })).toEqual([
      { id: 'a', label: 'Ada', submission: null },
    ])
  })

  it('attaches submitted values to the matching row', () => {
    const rows = buildFacilitatorRows(item([{ participantId: 'a', best: 2 }]), {
      a: 'Ada',
    })

    expect(rows).toEqual([
      { id: 'a', label: 'Ada', submission: { best: 2, likely: 3, worst: 5 } },
    ])
  })

  it('adds an unannounced submitter after the announced ones, as "Teammate N", counting named members too', () => {
    const rows = buildFacilitatorRows(item([{ participantId: 'z', best: 1 }]), {
      a: 'Ada',
    })

    expect(rows.map((r) => [r.id, r.label])).toEqual([
      ['a', 'Ada'],
      ['z', 'Teammate 2'],
    ])
  })

  it('does not repeat someone who both announced and submitted', () => {
    const rows = buildFacilitatorRows(item([{ participantId: 'a', best: 1 }]), {
      a: 'Ada',
    })

    expect(rows).toHaveLength(1)
  })

  it('numbers every member, named or not, so a Teammate label matches the participant view', () => {
    const rows = buildFacilitatorRows(
      item([
        { participantId: 'z', best: 1 },
        { participantId: 'y', best: 1 },
      ]),
      { a: 'Ada' },
    )

    expect(rows.map((r) => r.label)).toEqual(['Ada', 'Teammate 2', 'Teammate 3'])
  })
})
