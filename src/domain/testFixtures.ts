import { aggregateEstimates, createEstimate } from './estimate'
import type { AggregateResult, Estimate } from './estimate'
import type { Item, RoundState } from './types'

export function estimateOf(
  participantId: string,
  best = 1,
  likely = 2,
  worst = 3,
): Estimate {
  const result = createEstimate({ participantId, best, likely, worst })
  if (!result.ok) throw new Error(result.error)
  return result.value
}

export function itemOf(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item-1',
    title: 'Item',
    description: '',
    notes: '',
    state: { phase: 'collecting', submissions: [] },
    round: 0,
    ...overrides,
  }
}

export function finalizedItemOf(overrides: Partial<Item> = {}): Item {
  return itemOf({
    state: {
      phase: 'finalized',
      submissions: [],
      result: aggregateEstimates([estimateOf('p')]),
    },
    ...overrides,
  })
}

export function collecting(submissions: Estimate[] = []): RoundState {
  return { phase: 'collecting', submissions }
}

export function revealedWith(submissions: Estimate[] = []): RoundState {
  return { phase: 'revealed', submissions }
}

export function finalizedWith(
  result: AggregateResult,
  submissions: Estimate[] = [],
): RoundState {
  return { phase: 'finalized', submissions, result }
}

/** The item's final range, or null while it is not finalized. */
export function finalResultOf(item: Item): AggregateResult | null {
  return item.state.phase === 'finalized' ? item.state.result : null
}
