import type { AggregateResult } from './estimate'
import type { Item } from './types'

/** Whether an item's estimate has been finalized — narrows `finalResult` to
 *  non-null, so callers don't re-spell the `!== null` test. */
export function isFinalized(item: Item): item is Item & { finalResult: AggregateResult } {
  return item.finalResult !== null
}

/** The id of the first item that still needs an estimate, or null if none. */
export function firstPendingItemId(items: Item[]): string | null {
  const pending = items.find((item) => !isFinalized(item))
  return pending ? pending.id : null
}

/** The part of the session an item-list edit can change. */
export interface ItemList {
  items: Item[]
  activeItemId: string | null
}

/** Append a new item built from a trimmed title. The caller supplies the id
 *  (generating one is an effect). A blank title is a no-op (`null`). Adding the
 *  first item to an empty workspace selects it, so the panel switches from the
 *  "add an item" empty state to the widget. */
export function appendItem(
  state: ItemList,
  draft: { id: string; title: string; description: string },
): ItemList | null {
  const title = draft.title.trim()
  if (title.length === 0) return null
  const item: Item = {
    id: draft.id,
    title,
    description: draft.description,
    notes: '',
    finalResult: null,
    submissions: [],
    revealed: false,
    round: 0,
  }
  return {
    items: [...state.items, item],
    activeItemId: state.activeItemId ?? item.id,
  }
}

/** Remove item `id`. If it was the active one, fall back to the next pending
 *  item so the panel doesn't drop to the empty state while work remains. */
export function removeItemFrom(state: ItemList, id: string): ItemList {
  const items = state.items.filter((item) => item.id !== id)
  if (state.activeItemId !== id) return { items, activeItemId: state.activeItemId }
  return { items, activeItemId: firstPendingItemId(items) }
}

/** Move the item at `fromIndex` to `toIndex`. An out-of-range `fromIndex` is a
 *  no-op (`null`); `toIndex` is clamped by the splice. */
export function moveItem(
  items: Item[],
  fromIndex: number,
  toIndex: number,
): Item[] | null {
  const moved = items[fromIndex]
  if (!moved) return null
  const next = [...items]
  next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}

/** Merge `patch` into the item with id `id`, leaving the others untouched. */
export function updateItem(items: Item[], id: string, patch: Partial<Item>): Item[] {
  return items.map((item) => (item.id === id ? { ...item, ...patch } : item))
}
