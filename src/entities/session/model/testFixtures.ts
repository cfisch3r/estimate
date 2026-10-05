import { aggregateEstimates, createEstimate } from '../../estimate/@x/session'
import type { Estimate } from '../../estimate/@x/session'
import type { Item } from './types'

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
    finalResult: null,
    submissions: [],
    revealed: false,
    round: 0,
    ...overrides,
  }
}

export function finalizedItemOf(overrides: Partial<Item> = {}): Item {
  return itemOf({ finalResult: aggregateEstimates([estimateOf('p')]), ...overrides })
}
