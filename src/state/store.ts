import { create } from 'zustand'
import type { EstimationUnit, Estimate } from '../calc'
import { createEstimate, aggregateEstimates } from '../calc'
import type { SessionSnapshot } from '../network/actions'
import type {
  Item,
  LiveConnectionStatus,
  LiveRound,
  ScreenId,
  SessionMode,
  SessionRole,
} from './types'

type FinalizeResult = { ok: true } | { ok: false; error: string }

/** submitEstimate returns the stored Estimate so the caller broadcasts exactly
 *  what was recorded — no re-lookup by a key that might not round-trip. */
type SubmitEstimateResult =
  { ok: true; estimate: Estimate } | { ok: false; error: string }

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
  /** Stable per-join id for this participant, used as the submission key. */
  participantId: string
  connectionStatus: LiveConnectionStatus
  peerCount: number
  /** Participant-only view of the facilitator's current round; null otherwise. */
  liveRound: LiveRound | null
  /** Display names for every announced client in the session, keyed by the same
   *  `participantId` submissions carry. Seeded with this client's own entry on
   *  join; filled from peers' `announce` messages. */
  participantNames: Record<string, string>

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

  /** Participant: adopt the facilitator's broadcast round state. */
  applySyncState: (snapshot: SessionSnapshot) => void
  /** Participant: record another participant's incoming submission. */
  applyRemoteEstimate: (estimate: Estimate) => void
  /** Participant: mark the current round revealed once the facilitator reveals it. */
  applyReveal: (itemId: string) => void
  /** Record a peer's (or own) `participantId -> display name` mapping. */
  applyParticipantName: (participantId: string, name: string) => void
  /** Participant: validate and record this client's own estimate for the round. */
  submitEstimate: (best: number, likely: number, worst: number) => SubmitEstimateResult
}

/** Upsert `next` into `list` keyed by participantId — last write wins, insertion
 *  order (and thus submission order) preserved for existing entries. */
function upsertByParticipant(list: Estimate[], next: Estimate): Estimate[] {
  const index = list.findIndex((e) => e.participantId === next.participantId)
  if (index === -1) return [...list, next]
  const copy = [...list]
  copy[index] = next
  return copy
}

function snapshotSubmissionsToEstimates(snapshot: SessionSnapshot): Estimate[] {
  const estimates: Estimate[] = []
  for (const raw of snapshot.submissions) {
    const result = createEstimate(raw)
    if (result.ok) estimates.push(result.value)
  }
  return estimates
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
  participantId: '',
  connectionStatus: 'idle',
  peerCount: 0,
  liveRound: null,
  participantNames: {},
  // A participant only ever inherits its unit from the facilitator's snapshot
  // (see applySyncState); reset it on leave so a unit picked up from one session
  // doesn't leak into the user's next single-user / facilitator workspace.
  unit: 'days',
} as const satisfies Pick<
  SessionStore,
  | 'mode'
  | 'role'
  | 'sessionId'
  | 'myName'
  | 'participantId'
  | 'connectionStatus'
  | 'peerCount'
  | 'liveRound'
  | 'participantNames'
  | 'unit'
>

export const useSessionStore = create<SessionStore>((set, get) => ({
  currentScreen: 'mode-select',
  sessionName: '',
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
      participantNames: { facilitator: 'Facilitator' },
      connectionStatus: 'connecting',
      peerCount: 0,
      currentScreen: 'workspace',
      activeItemId: firstPendingItemId(items),
    })
  },

  joinLiveSession: (sessionCode, name) => {
    const code = sessionCode.trim().toUpperCase()
    const trimmedName = name.trim()
    if (code.length === 0 || trimmedName.length === 0) return
    const participantId = crypto.randomUUID()
    set({
      mode: 'live',
      role: 'participant',
      sessionId: code,
      myName: trimmedName,
      participantId,
      participantNames: { [participantId]: trimmedName },
      connectionStatus: 'connecting',
      peerCount: 0,
      liveRound: null,
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

  applySyncState: (snapshot) =>
    set((state) => {
      // Participants estimate in the facilitator's unit, not their local default.
      if (snapshot.currentItem === null) {
        return { liveRound: null, unit: snapshot.unit }
      }
      const prev = state.liveRound
      const sameItem = prev?.item.id === snapshot.currentItem.id
      const incoming = snapshotSubmissionsToEstimates(snapshot)
      const submissions = sameItem
        ? incoming.reduce(upsertByParticipant, prev!.submissions)
        : incoming
      return {
        unit: snapshot.unit,
        liveRound: {
          item: snapshot.currentItem,
          submissions,
          revealed: sameItem ? prev!.revealed : false,
          mySubmission: sameItem ? prev!.mySubmission : null,
        },
      }
    }),

  applyRemoteEstimate: (estimate) =>
    set((state) => {
      if (!state.liveRound) return {}
      return {
        liveRound: {
          ...state.liveRound,
          submissions: upsertByParticipant(state.liveRound.submissions, estimate),
        },
      }
    }),

  applyReveal: (itemId) =>
    set((state) => {
      if (!state.liveRound || state.liveRound.item.id !== itemId) return {}
      return { liveRound: { ...state.liveRound, revealed: true } }
    }),

  applyParticipantName: (participantId, name) =>
    set((state) => ({
      participantNames: { ...state.participantNames, [participantId]: name },
    })),

  submitEstimate: (best, likely, worst) => {
    const { liveRound, participantId } = get()
    if (!liveRound) {
      return { ok: false, error: 'No active round to estimate.' }
    }
    const result = createEstimate({
      participantId: participantId || 'me',
      best,
      likely,
      worst,
    })
    if (!result.ok) {
      return result
    }
    set((state) =>
      state.liveRound
        ? {
            liveRound: {
              ...state.liveRound,
              mySubmission: { best, likely, worst },
              submissions: upsertByParticipant(state.liveRound.submissions, result.value),
            },
          }
        : {},
    )
    return { ok: true, estimate: result.value }
  },
}))
