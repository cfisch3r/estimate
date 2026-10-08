import type { AggregateResult } from './estimate'
import type { Item } from './types'

/** Whether an item's estimate has been finalized — narrows `finalResult` to
 *  non-null, so callers don't re-spell the `!== null` test. */
export function isFinalized(item: Item): item is Item & { finalResult: AggregateResult } {
  return item.finalResult !== null
}
