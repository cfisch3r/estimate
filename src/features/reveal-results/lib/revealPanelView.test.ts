import { describe, expect, it } from 'vitest'
import { aggregateEstimates } from '../../../domain/estimate'
import { aggregateOf, estimateOf, itemOf } from '../../../domain/testFixtures'
import { revealPanelView } from './revealPanelView'

const finalResult = aggregateOf(2, 3, 6)
const submissions = [estimateOf('a'), estimateOf('b')]

describe('revealPanelView', () => {
  it('waits for estimates while the round is open', () => {
    expect(revealPanelView(itemOf({ submissions }))).toEqual({
      revealed: false,
      roundOpen: true,
      submittedCount: 2,
      range: null,
      footer: 'preReveal',
    })
  })

  it('shows the aggregated range for review once revealed', () => {
    expect(revealPanelView(itemOf({ submissions, revealed: true }))).toMatchObject({
      revealed: true,
      roundOpen: false,
      range: { kind: 'aggregated', values: aggregateEstimates(submissions) },
      footer: 'review',
    })
  })

  it('shows no range for a revealed round nobody submitted to', () => {
    expect(revealPanelView(itemOf({ revealed: true })).range).toBeNull()
  })

  it('offers update and reopen for an item finalized after its reveal', () => {
    expect(
      revealPanelView(itemOf({ submissions, revealed: true, finalResult })).footer,
    ).toBe('finalized')
  })

  it('shows the saved range for an item finalized before the load', () => {
    expect(revealPanelView(itemOf({ finalResult }))).toEqual({
      revealed: false,
      roundOpen: false,
      submittedCount: 0,
      range: { kind: 'finalized', values: finalResult },
      footer: 'resumedFinalized',
    })
  })
})
