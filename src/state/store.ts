import { create } from 'zustand'
import type { AggregateResult, EstimationUnit, Estimate } from '../calc'
import { createEstimate, aggregateEstimates } from '../calc'
import type { SessionSnapshot } from '../network/actions'
import { getOrCreateParticipantId } from './participantIdentity'
import type {
  Item,
  LiveConnectionStatus,
  LiveRound,
  ScreenId,
  SessionMode,
  SessionRole,
} from './types'

export type FinalizeResult = { ok: true } | { ok: false; error: string }

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
  /** Stable per-browser id for this participant (persisted in `localStorage`, reused
   *  across joins/reconnects), used as the submission key. */
  participantId: string
  connectionStatus: LiveConnectionStatus
  /** Whether this client has reached at least one peer since joining the current
   *  session. Distinguishes "still trying to get in" from "was in, lost it" —
   *  the tracker can't, because it is rebuilt from scratch on every reconnect. */
  hasEverConnected: boolean
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
  /** Facilitator/single-user: leave the workspace entirely, back to mode-select.
   *  Unlike `leaveLiveSession` (used by the participant-side leave flows, which
   *  never own items), this also clears the item list and session name so the
   *  next mode choice starts from a blank slate. */
  leaveWorkspace: () => void
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
  /** Facilitator only: record an incoming targeted submission for `itemId`
   *  into that item's `submissions`. A submission whose `itemId` isn't the
   *  active item is dropped, and so is one whose `round` doesn't match the
   *  active item's round. Participants never receive another peer's estimate
   *  — `sendEstimate` targets the facilitator only (ADR-003, "Single owner") —
   *  so there is no participant-side handling here. */
  applyRemoteEstimate: (itemId: string, estimate: Estimate, round?: number) => void
  /** Record a peer's (or own) `participantId -> display name` mapping. */
  applyParticipantName: (participantId: string, name: string) => void
  /** Facilitator: forget a departed peer's display name once its connection drops. */
  removeParticipant: (participantId: string) => void
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
  hasEverConnected: false,
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
  | 'hasEverConnected'
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
      hasEverConnected: false,
      peerCount: 0,
      currentScreen: 'workspace',
      activeItemId: firstPendingItemId(items),
    })
  },

  joinLiveSession: (sessionCode, name) => {
    const code = sessionCode.trim().toUpperCase()
    const trimmedName = name.trim()
    if (code.length === 0 || trimmedName.length === 0) return
    const participantId = getOrCreateParticipantId()
    set({
      mode: 'live',
      role: 'participant',
      sessionId: code,
      myName: trimmedName,
      participantId,
      participantNames: { [participantId]: trimmedName },
      connectionStatus: 'connecting',
      hasEverConnected: false,
      peerCount: 0,
      liveRound: null,
      currentScreen: 'join',
    })
  },

  leaveLiveSession: () => set({ ...LIVE_SESSION_DEFAULTS, currentScreen: 'mode-select' }),

  leaveWorkspace: () => {
    get().leaveLiveSession()
    set({ items: [], sessionName: '', activeItemId: null })
  },

  setMode: (mode) => set({ mode }),

  setConnectionStatus: (status) =>
    set((state) => ({
      connectionStatus: status,
      hasEverConnected: state.hasEverConnected || status === 'connected',
    })),

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
      // Discards the round's submissions and returns it to the waiting state.
      // Also used, behind a confirm step in the UI, to reopen an already-finalized
      // item — clearing `finalResult` so a stale range doesn't linger next to the
      // new round. Bumping `round` is what lets a participant that reconnects after
      // missing both the Reveal and this Retry tell the new round apart from the
      // old one (ADR-003, "Versioned rounds") — see `applySyncState`.
      items: state.items.map((item) =>
        item.id === id
          ? {
              ...item,
              submissions: [],
              revealed: false,
              round: item.round + 1,
              finalResult: null,
            }
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
      // A same-item snapshot whose round differs from what we last saw is a
      // Retry — whether or not we saw the Reveal in between. Drop the stale
      // round-local state so a peer doesn't sit in the waiting view for the
      // new round. This replaces the old "revealed flipped back off"
      // heuristic: Retry always bumps `round`, so this covers that case and
      // the one it couldn't (missing both the Reveal and the Retry) — see
      // ADR-003, "Versioned rounds".
      const roundChanged = sameItem && prev?.round !== snapshot.round
      // Pre-reveal, estimate values never reach a participant at all (ADR-003,
      // "Single owner") — only the roster drives "N of M submitted". Post-reveal,
      // the snapshot's frozen submission set is the only source.
      const submissions = snapshot.revealed
        ? snapshotSubmissionsToEstimates(snapshot)
        : []
      return {
        unit: snapshot.unit,
        liveRound: {
          item: snapshot.currentItem,
          submissions,
          // The facilitator's snapshot is authoritative for reveal state (it's
          // pulled on every connect/reconnect, unlike a one-shot event), so a
          // peer joining or reconnecting mid-reveal lands on the revealed view
          // and a peer that missed a Retry is un-latched.
          revealed: snapshot.revealed,
          round: snapshot.round,
          roster: snapshot.roster,
          mySubmission: sameItem && !roundChanged ? prev!.mySubmission : null,
        },
      }
    }),

  applyRemoteEstimate: (itemId, estimate, round) =>
    set((state) => {
      // Facilitator-only: `sendEstimate` targets the facilitator alone, so a
      // participant never receives another peer's estimate (ADR-003, "Single
      // owner") and this handler is never invoked on a participant client.
      // Only record if this submission is for the item the round is running on
      // — a straggler for a just-finalized item must not seed the next round —
      // and only while that round is still open: a late submission must not
      // move a range the group has seen.
      const active = state.items.find((item) => item.id === state.activeItemId)
      if (
        !active ||
        // An empty itemId is a pre-#8 peer's bare estimate — record it against
        // the active round (legacy behaviour) rather than dropping it.
        (itemId && itemId !== active.id) ||
        active.revealed ||
        active.finalResult !== null ||
        // A round mismatch means this submission belongs to a round the
        // participant hasn't caught up past yet (a stale in-flight send from
        // before a Retry). A missing `round` (older build) bypasses this
        // check rather than being treated as stale.
        (round !== undefined && round !== active.round)
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
    }),

  applyParticipantName: (participantId, name) =>
    set((state) => ({
      participantNames: { ...state.participantNames, [participantId]: name },
    })),

  removeParticipant: (participantId) =>
    set((state) => {
      const { [participantId]: _removed, ...rest } = state.participantNames
      return { participantNames: rest }
    }),

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
