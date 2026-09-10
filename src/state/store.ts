import { create } from 'zustand'
import type { AggregateResult, EstimationUnit, Estimate } from '../calc'
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
  /** Facilitator: finalize a live item by aggregating the participant
   *  submissions it has collected this round (Workspace state 1d). */
  finalizeLiveItem: (id: string) => FinalizeResult
  /** Facilitator: reveal the current round's estimates for `id` (1c -> 1d). */
  revealRound: (id: string) => void
  /** Facilitator: discard this item's submissions and drop back to the waiting
   *  state (1d -> 1c) so participants estimate the item again. */
  retryRound: (id: string) => void
  goToScreen: (screen: ScreenId) => void

  /** Participant: adopt the facilitator's broadcast round state. */
  applySyncState: (snapshot: SessionSnapshot) => void
  /** Record an incoming peer submission for `itemId`: into that item's
   *  `submissions` for a facilitator, into `liveRound` for a participant. A
   *  submission whose `itemId` isn't the current round is dropped. */
  applyRemoteEstimate: (itemId: string, estimate: Estimate) => void
  /** Participant: mark the current round revealed once the facilitator reveals it. */
  applyReveal: (itemId: string) => void
  /** Participant: drop back to the estimating state when the facilitator starts
   *  a new round for `itemId` (Retry). */
  applyRoundReset: (itemId: string) => void
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

/** Shared body of `finalizeItem` / `finalizeLiveItem`: record `finalResult` on
 *  `id` and, unless it was already finalized (a re-finalize/edit), advance the
 *  active item to the next pending one. */
function recordFinalResult(
  state: Pick<SessionStore, 'items'>,
  id: string,
  finalResult: AggregateResult,
): Pick<SessionStore, 'items' | 'activeItemId'> {
  const wasAlreadyFinalized =
    state.items.find((item) => item.id === id)?.finalResult !== null
  const items = state.items.map((item) =>
    item.id === id ? { ...item, finalResult } : item,
  )
  const activeItemId = wasAlreadyFinalized ? id : firstPendingItemId(items, id)
  return { items, activeItemId }
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
        submissions: [],
        revealed: false,
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
    set((state) => recordFinalResult(state, id, finalResult))
    return { ok: true }
  },

  finalizeLiveItem: (id) => {
    const item = get().items.find((i) => i.id === id)
    if (!item) {
      return { ok: false, error: 'Unknown item.' }
    }
    if (item.submissions.length === 0) {
      return { ok: false, error: 'No estimates have been submitted yet.' }
    }
    const finalResult = aggregateEstimates(item.submissions)
    set((state) => recordFinalResult(state, id, finalResult))
    return { ok: true }
  },

  revealRound: (id) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, revealed: true } : item,
      ),
    })),

  retryRound: (id) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id
          ? // Clear the recorded result too: "start a new round" on an item that
            // was already finalized must reopen it, otherwise applyRemoteEstimate's
            // `finalResult === null` guard would silently drop every new submission.
            { ...item, submissions: [], revealed: false, finalResult: null }
          : item,
      ),
    })),

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
          // The facilitator's snapshot is authoritative for reveal state (it's
          // re-sent on every peer join, unlike the one-shot roundReset), so a
          // peer joining or reconnecting mid-reveal lands on the revealed view,
          // and a peer that missed a roundReset is un-latched by the next sync.
          revealed: snapshot.revealed,
          mySubmission: sameItem ? prev!.mySubmission : null,
        },
      }
    }),

  applyRemoteEstimate: (itemId, estimate) =>
    set((state) => {
      if (state.role === 'facilitator') {
        // Only record if this submission is for the item the round is running on
        // — a straggler for a just-finalized item must not seed the next round —
        // and only while that round is still open: a late (or peer-join
        // re-broadcast) submission must not move a range the group has seen.
        const active = state.items.find((item) => item.id === state.activeItemId)
        if (
          !active ||
          itemId !== active.id ||
          active.revealed ||
          active.finalResult !== null
        ) {
          return {}
        }
        return {
          items: state.items.map((item) =>
            item.id === active.id
              ? { ...item, submissions: upsertByParticipant(item.submissions, estimate) }
              : item,
          ),
        }
      }
      // Same "round still open" rule for a participant, so their revealed range
      // bar doesn't shift when a peer re-broadcasts after the reveal.
      if (
        !state.liveRound ||
        state.liveRound.item.id !== itemId ||
        state.liveRound.revealed
      ) {
        return {}
      }
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

  applyRoundReset: (itemId) =>
    set((state) => {
      if (!state.liveRound || state.liveRound.item.id !== itemId) return {}
      return {
        liveRound: {
          ...state.liveRound,
          submissions: [],
          revealed: false,
          mySubmission: null,
        },
      }
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
