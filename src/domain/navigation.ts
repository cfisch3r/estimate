import { isFinalized } from './item'
import type { Item } from './types'

/** What advancing from an item does. */
export type Advance =
  | { kind: 'none' }
  | { kind: 'select'; itemId: string }
  | { kind: 'summary'; clearSelection: boolean }

/** Where "next" goes from the item at `activeIndex`, which the caller has just
 *  (re-)finalized. Both moves go to whichever item is adjacent in the sidebar's
 *  list order — not the next *pending* item.
 *
 *  `items` is the list as of the caller's last render, so the item at
 *  `activeIndex` still shows its pre-click state; it is therefore skipped in the
 *  "everything is finalized" check instead of re-read after the write. */
export function advanceFrom(items: Item[], activeIndex: number): Advance {
  const current = items[activeIndex]
  if (current === undefined) return { kind: 'none' }
  const next = items[activeIndex + 1]
  if (next !== undefined) return { kind: 'select', itemId: next.id }
  // Nothing left to work on — clear the selection so returning to the workspace
  // (e.g. via Summary's "Back to item") shows the "all items finalized" empty
  // state instead of reopening this now-done item.
  const allOthersFinalized = items.every(
    (item, idx) => idx === activeIndex || isFinalized(item),
  )
  return { kind: 'summary', clearSelection: allOthersFinalized }
}

/** The id of the item before `activeIndex`, or null when there is none. */
export function previousItemId(items: Item[], activeIndex: number): string | null {
  const previous = activeIndex > 0 ? items[activeIndex - 1] : undefined
  return previous ? previous.id : null
}
