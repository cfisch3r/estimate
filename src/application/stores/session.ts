import { create } from 'zustand'
import type { EstimationUnit } from '../../domain/estimate'
import {
  appendItem,
  firstPendingItemId,
  moveItem,
  removeItemFrom,
  updateItem,
} from '../../domain/item'
import type { Item } from '../../domain/types'

interface SessionStore {
  sessionName: string
  unit: EstimationUnit
  items: Item[]
  activeItemId: string | null

  setSessionName: (name: string) => void
  setUnit: (unit: EstimationUnit) => void
  /** Back to the default unit. A participant only ever inherits its unit from
   *  the facilitator's snapshot (see `useCases/applyFacilitatorSnapshot.ts`), so leaving a
   *  live session resets it, lest it leak into the next workspace. */
  resetUnit: () => void
  addItem: (title: string, description?: string) => void
  setItemTitle: (id: string, title: string) => void
  removeItem: (id: string) => void
  reorderItems: (fromIndex: number, toIndex: number) => void
  /** Passing null clears the selection (e.g. after finalizing the last item
   *  that still needed one), showing the "all items finalized" empty state. */
  selectItem: (id: string | null) => void
  /** Select the first item that still needs an estimate (null if none). */
  selectFirstPending: () => void
  setItemNotes: (id: string, notes: string) => void
  setItemDescription: (id: string, description: string) => void
  /** Reset back to a blank workspace: no items, no session name, no
   *  selection. Composed with the other two stores' own leave-resets by
   *  `useLeaveWorkspace` (`features/session-lifecycle`) — see ADR-005. */
  clearSession: () => void
}

const DEFAULT_UNIT: EstimationUnit = 'days'

export const useSessionStore = create<SessionStore>((set) => ({
  sessionName: '',
  unit: DEFAULT_UNIT,
  items: [],
  activeItemId: null,

  setSessionName: (name) => set({ sessionName: name }),

  setUnit: (unit) => set({ unit }),
  resetUnit: () => set({ unit: DEFAULT_UNIT }),

  addItem: (title, description = '') =>
    set(
      (state) =>
        appendItem(state, { id: crypto.randomUUID(), title, description }) ?? state,
    ),

  setItemTitle: (id, title) =>
    set((state) => ({ items: updateItem(state.items, id, { title: title.trim() }) })),

  removeItem: (id) => set((state) => removeItemFrom(state, id)),

  reorderItems: (fromIndex, toIndex) =>
    set((state) => {
      const items = moveItem(state.items, fromIndex, toIndex)
      return items ? { items } : {}
    }),

  selectItem: (id) => set({ activeItemId: id }),
  selectFirstPending: () =>
    set((state) => ({ activeItemId: firstPendingItemId(state.items) })),

  setItemNotes: (id, notes) =>
    set((state) => ({ items: updateItem(state.items, id, { notes }) })),

  setItemDescription: (id, description) =>
    set((state) => ({ items: updateItem(state.items, id, { description }) })),

  clearSession: () => set({ items: [], sessionName: '', activeItemId: null }),
}))

/** Merge a round outcome into item `id`. Module-level (not a store action) and
 *  consumed only by `round.ts`, so round mechanics stay out of this store's
 *  interface — see ADR-005, Option D. Scoped to round-owned fields, so it can't
 *  bypass `setItemTitle`/`setItemNotes`/`setItemDescription`'s validation of the
 *  content fields they own. */
export function patchItem(
  id: string,
  patch: Partial<Pick<Item, 'finalResult' | 'revealed' | 'round' | 'submissions'>>,
): void {
  useSessionStore.setState((state) => ({ items: updateItem(state.items, id, patch) }))
}
