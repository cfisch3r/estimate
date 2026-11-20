import { aggregateEstimates, type AggregateValues } from '../../../domain/estimate'
import { isFinalized, livePhaseOf } from '../../../domain/item'
import type { Item } from '../../../domain/types'

/** Which footer the facilitator's panel shows. */
export type RevealFooter = 'preReveal' | 'review' | 'finalized' | 'resumedFinalized'

export interface RevealPanelView {
  /** The round is revealed: the roster shows each participant's values. */
  revealed: boolean
  /** A round is open for estimates: the roster shows Submitted / Waiting
   *  and the submitted count is announced. */
  roundOpen: boolean
  submittedCount: number
  /** The range to show, if any: a revealed round's aggregate, or the saved
   *  result of an item finalized before the load. */
  range: { kind: 'aggregated' | 'finalized'; values: AggregateValues } | null
  footer: RevealFooter
}

/** What the facilitator's live panel shows for `item`, from its live phase. */
export function revealPanelView(item: Item): RevealPanelView {
  const live = livePhaseOf(item)
  const submittedCount = item.submissions.length
  const base = { revealed: item.revealed, submittedCount }
  switch (live.phase) {
    case 'finalizedEarlier':
      return {
        ...base,
        roundOpen: false,
        range: { kind: 'finalized', values: live.finalResult },
        footer: 'resumedFinalized',
      }
    case 'revealed':
      return {
        ...base,
        roundOpen: false,
        range:
          submittedCount > 0
            ? { kind: 'aggregated', values: aggregateEstimates(item.submissions) }
            : null,
        footer: isFinalized(item) ? 'finalized' : 'review',
      }
    case 'open':
      return { ...base, roundOpen: true, range: null, footer: 'preReveal' }
  }
}
