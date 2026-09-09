import { create } from 'zustand'
import type { EstimationUnit } from '../calc'
import { createEstimate, aggregateEstimates } from '../calc'
import type {
  Item,
  LiveConnectionStatus,
  ScreenId,
  SessionMode,
  SessionRole,
} from './types'

type FinalizeResult = { ok: true } | { ok: false; error: string }

interface SessionStore {
  currentScreen: ScreenId
  sessionName: string
  unit: EstimationUnit
  items: Item[]
  activeItemId: string | null

  mode: SessionMode
  role: SessionRole
  sessionId: string | null
  myName: string
  connectionStatus: LiveConnectionStatus
  peerCount: number

  setSessionName: (name: string) => void
  setUnit: (unit: EstimationUnit) => void
  addItem: (title: string, description?: string) => void
  updateItem: (id: string, updates: { title: string; description: string }) => void
  removeItem: (id: string) => void
  reorderItems: (fromIndex: number, toIndex: number) => void
  startSingleUser: () => void
  startCollaborative: (sessionCode: string) => void
  joinLiveSession: (sessionCode: string, name: string) => void
  leaveLiveSession: () => void
  setMode: (mode: SessionMode) => void
  setConnectionStatus: (status: LiveConnectionStatus) => void
  setPeerCount: (count: number) => void
  selectItem: (id: string) => void
  setItemNotes: (id: string, notes: string) => void
  setItemDescription: (id: string, description: string) => void
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

const LIVE_SESSION_DEFAULTS = {
  mode: 'manual',
  role: 'facilitator',
  sessionId: null,
  myName: '',
  connectionStatus: 'idle',
  peerCount: 0,
} as const satisfies Pick<
  SessionStore,
  'mode' | 'role' | 'sessionId' | 'myName' | 'connectionStatus' | 'peerCount'
>

export const useSessionStore = create<SessionStore>((set, get) => ({
  currentScreen: 'mode-select',
  sessionName: '',
  unit: 'days',
  items: [],
  activeItemId: null,
  ...LIVE_SESSION_DEFAULTS,

  setSessionName: (name) => set({ sessionName: name }),

  setUnit: (unit) => set({ unit }),

  addItem: (title, description = '') => {
    const trimmed = title.trim()
    if (trimmed.length === 0) return
    set((state) => {
      const newItem = {
        id: crypto.randomUUID(),
        title: trimmed,
        description,
        notes: '',
        finalResult: null,
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

  startSingleUser: () => {
    const { items } = get()
    set({ currentScreen: 'workspace', activeItemId: firstPendingItemId(items) })
  },

  startCollaborative: (sessionCode) => {
    const { items } = get()
    set({
      mode: 'live',
      role: 'facilitator',
      sessionId: sessionCode,
      myName: 'Facilitator',
      connectionStatus: 'connecting',
      peerCount: 0,
      currentScreen: 'workspace',
      activeItemId: firstPendingItemId(items),
    })
  },

  joinLiveSession: (sessionCode, name) => {
    const code = sessionCode.trim().toUpperCase()
    if (code.length === 0 || name.trim().length === 0) return
    set({
      mode: 'live',
      role: 'participant',
      sessionId: code,
      myName: name.trim(),
      connectionStatus: 'connecting',
      peerCount: 0,
      currentScreen: 'join',
    })
  },

  leaveLiveSession: () => set({ ...LIVE_SESSION_DEFAULTS, currentScreen: 'mode-select' }),

  setMode: (mode) => set({ mode }),

  setConnectionStatus: (status) => set({ connectionStatus: status }),

  setPeerCount: (count) => set({ peerCount: count }),

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
