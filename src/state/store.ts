import { create } from 'zustand'
import type { EstimationUnit } from '../calc'
import { createEstimate, aggregateEstimates } from '../calc'
import type { Item, ScreenId } from './types'

type FinalizeResult = { ok: true } | { ok: false; error: string }

interface SessionStore {
  currentScreen: ScreenId
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
  createSession: () => void
  selectItem: (id: string) => void
  setItemNotes: (id: string, notes: string) => void
  finalizeItem: (
    id: string,
    best: number,
    likely: number,
    worst: number,
  ) => FinalizeResult
  goToScreen: (screen: ScreenId) => void
}

function firstPendingItemId(items: Item[], excludeId?: string): string | null {
  const pending = items.find((item) => item.id !== excludeId && item.finalResult === null)
  return pending ? pending.id : null
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  currentScreen: 'create',
  sessionName: '',
  unit: 'days',
  items: [],
  activeItemId: null,

  setSessionName: (name) => set({ sessionName: name }),

  setUnit: (unit) => set({ unit }),

  addItem: (title, description = '') => {
    const trimmed = title.trim()
    if (trimmed.length === 0) return
    set((state) => ({
      items: [
        ...state.items,
        {
          id: crypto.randomUUID(),
          title: trimmed,
          description,
          notes: '',
          finalResult: null,
        },
      ],
    }))
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
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
      activeItemId: state.activeItemId === id ? null : state.activeItemId,
    })),

  reorderItems: (fromIndex, toIndex) =>
    set((state) => {
      const items = [...state.items]
      const moved = items[fromIndex]
      if (!moved) return {}
      items.splice(fromIndex, 1)
      items.splice(toIndex, 0, moved)
      return { items }
    }),

  createSession: () => {
    const { sessionName, items } = get()
    if (sessionName.trim().length === 0 || items.length === 0) return
    set({ currentScreen: 'session', activeItemId: firstPendingItemId(items) })
  },

  selectItem: (id) => set({ activeItemId: id }),

  setItemNotes: (id, notes) =>
    set((state) => ({
      items: state.items.map((item) => (item.id === id ? { ...item, notes } : item)),
    })),

  finalizeItem: (id, best, likely, worst) => {
    const estimateResult = createEstimate({
      participantId: 'facilitator',
      best,
      likely,
      worst,
    })
    if (!estimateResult.ok) {
      return estimateResult
    }
    const finalResult = aggregateEstimates([estimateResult.value])
    set((state) => {
      const wasAlreadyFinalized =
        state.items.find((item) => item.id === id)?.finalResult !== null
      const items = state.items.map((item) =>
        item.id === id ? { ...item, finalResult } : item,
      )
      const activeItemId = wasAlreadyFinalized ? id : firstPendingItemId(items, id)
      return { items, activeItemId }
    })
    return { ok: true }
  },

  goToScreen: (screen) => set({ currentScreen: screen }),
}))
