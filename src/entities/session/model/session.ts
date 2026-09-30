import { create } from 'zustand'
import type { EstimationUnit } from '../../estimate'
import type { Item } from './types'

interface SessionStore {
  sessionName: string
  unit: EstimationUnit
  items: Item[]
  activeItemId: string | null

  setSessionName: (name: string) => void
  setUnit: (unit: EstimationUnit) => void
  addItem: (title: string, description?: string) => void
  updateItem: (id: string, updates: { title: string; description: string }) => void
  removeItem: (id: string) => void
  reorderItems: (fromIndex: number, toIndex: number) => void
  /** Passing null clears the selection (e.g. after finalizing the last item
   *  that still needed one), showing the "all items finalized" empty state. */
  selectItem: (id: string | null) => void
  setItemNotes: (id: string, notes: string) => void
  setItemDescription: (id: string, description: string) => void
  /** Merge `patch` into item `id`. General-purpose escape hatch for
   *  `entities/session/model/round.ts` (a same-slice file, not a cross-slice
   *  caller) to record round outcomes (`finalResult`, `revealed`, `round`,
   *  `submissions`) onto an item without this store needing to know about
   *  round mechanics — see ADR-005, Option D. */
  patchItem: (id: string, patch: Partial<Item>) => void
  /** Reset back to a blank workspace: no items, no session name, no
   *  selection. Composed with the other two stores' own leave-resets by
   *  `useLeaveWorkspace` (`features/session-lifecycle`) — see ADR-005. */
  clearSession: () => void
}

export function firstPendingItemId(items: Item[], excludeId?: string): string | null {
  const pending = items.find((item) => item.id !== excludeId && item.finalResult === null)
  return pending ? pending.id : null
}

export const useSessionStore = create<SessionStore>((set) => ({
  sessionName: '',
  unit: 'days',
  items: [],
  activeItemId: null,

  setSessionName: (name) => set({ sessionName: name }),

  setUnit: (unit) => set({ unit }),

  addItem: (title, description = '') => {
    const trimmed = title.trim()
    if (trimmed.length === 0) return
    set((state) => {
      const newItem: Item = {
        id: crypto.randomUUID(),
        title: trimmed,
        description,
        notes: '',
        finalResult: null,
        submissions: [],
        revealed: false,
        round: 0,
      }
      return {
        items: [...state.items, newItem],
        // Adding the first item to an empty workspace selects it, so the
        // panel switches from the "add an item" empty state to the widget.
        activeItemId: state.activeItemId ?? newItem.id,
      }
    })
  },

  updateItem: (id, updates) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id
          ? { ...item, title: updates.title.trim(), description: updates.description }
          : item,
      ),
    })),

  removeItem: (id) =>
    set((state) => {
      const items = state.items.filter((item) => item.id !== id)
      if (state.activeItemId !== id) {
        return { items }
      }
      // The removed item was the active one — fall back to the next pending
      // item so the panel doesn't drop to the empty state while work remains.
      return { items, activeItemId: firstPendingItemId(items) }
    }),

  reorderItems: (fromIndex, toIndex) =>
    set((state) => {
      const items = [...state.items]
      const moved = items[fromIndex]
      if (!moved) return {}
      items.splice(fromIndex, 1)
      items.splice(toIndex, 0, moved)
      return { items }
    }),

  selectItem: (id) => set({ activeItemId: id }),

  setItemNotes: (id, notes) =>
    set((state) => ({
      items: state.items.map((item) => (item.id === id ? { ...item, notes } : item)),
    })),

  setItemDescription: (id, description) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, description } : item,
      ),
    })),

  patchItem: (id, patch) =>
    set((state) => ({
      items: state.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    })),

  clearSession: () => set({ items: [], sessionName: '', activeItemId: null }),
}))
