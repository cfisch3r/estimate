import { useMemo } from 'react'
import { useSessionStore } from '../stores'

/** The sidebar's item-list edits as one use case: add, remove and reorder. They
 *  carry real rules (a blank title is ignored, removing the active item falls
 *  back to the next pending one, the first item added is selected), which live in
 *  `domain/item.ts`; the UI calls them only through here. The returned object is
 *  stable across renders, so it is safe in effect dependencies. */
export function useItemActions(): {
  addItem: (title: string, description?: string) => void
  removeItem: (id: string) => void
  reorderItems: (fromIndex: number, toIndex: number) => void
} {
  const addItem = useSessionStore((s) => s.addItem)
  const removeItem = useSessionStore((s) => s.removeItem)
  const reorderItems = useSessionStore((s) => s.reorderItems)
  return useMemo(
    () => ({ addItem, removeItem, reorderItems }),
    [addItem, removeItem, reorderItems],
  )
}
