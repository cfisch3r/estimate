import { create } from 'zustand'
import type { Estimate } from '../../estimate/@x/session'
import { createEstimate, aggregateEstimates } from '../../estimate/@x/session'
import { FACILITATOR_PARTICIPANT_ID } from './participantId'
import { useConnectionStore } from './connection'
import { isFinalized } from './item'
import { patchItem, useSessionStore } from './session'
import type { LiveRound, SessionSnapshot } from './types'

export type FinalizeResult = { ok: true } | { ok: false; error: string }

/** submitEstimate returns the stored Estimate so the caller broadcasts exactly
 *  what was recorded — no re-lookup by a key that might not round-trip. */
type SubmitEstimateResult =
  { ok: true; estimate: Estimate } | { ok: false; error: string }

interface RoundStore {
  /** Participant-only view of the facilitator's current round; null otherwise. */
  liveRound: LiveRound | null

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
  /** Participant: adopt the facilitator's broadcast round state. */
  applySyncState: (snapshot: SessionSnapshot) => void
  /** Facilitator only: record an incoming targeted submission for `itemId`
   *  into that item's `submissions`. A submission whose `itemId` isn't the
   *  active item is dropped, and so is one whose `round` doesn't match the
   *  active item's round. Participants never receive another peer's estimate
   *  — `sendEstimate` targets the facilitator only (ADR-003, "Single owner") —
   *  so there is no participant-side handling here. */
  applyRemoteEstimate: (itemId: string, estimate: Estimate, round?: number) => void
  /** Participant: validate and record this client's own estimate for the round. */
  submitEstimate: (best: number, likely: number, worst: number) => SubmitEstimateResult
  /** Drop the participant-side round view. Composed alongside `connection.ts`'s
   *  `leaveLiveSession`/`joinLiveSession` by the `useLeaveLiveSession` /
   *  `useJoinLiveSession` composer hooks (`features/session-lifecycle`), not
   *  called from those actions directly — this store already reads
   *  `connection.ts`'s `role`, so the reverse call would create an import
   *  cycle between the two stores (see ADR-005). */
  clearRound: () => void
}

function snapshotSubmissionsToEstimates(snapshot: SessionSnapshot): Estimate[] {
  const estimates: Estimate[] = []
  for (const raw of snapshot.submissions) {
    const result = createEstimate(raw)
    if (result.ok) estimates.push(result.value)
  }
  return estimates
}

export const useRoundStore = create<RoundStore>((set, get) => ({
  liveRound: null,

  finalizeItem: (id, best, likely, worst) => {
    const estimateResult = createEstimate({
      participantId: FACILITATOR_PARTICIPANT_ID,
      best,
      likely,
      worst,
    })
    if (!estimateResult.ok) {
      return estimateResult
    }
    const finalResult = aggregateEstimates([estimateResult.value])
    patchItem(id, { finalResult })
    return { ok: true }
  },

  finalizeLiveItem: (id) => {
    const item = useSessionStore.getState().items.find((i) => i.id === id)
    if (!item) {
      return { ok: false, error: 'Unknown item.' }
    }
    if (item.submissions.length === 0) {
      return { ok: false, error: 'No estimates have been submitted yet.' }
    }
    const finalResult = aggregateEstimates(item.submissions)
    patchItem(id, { finalResult })
    return { ok: true }
  },

  revealRound: (id) => patchItem(id, { revealed: true }),

  retryRound: (id) => {
    const item = useSessionStore.getState().items.find((i) => i.id === id)
    if (!item) return
    // Discards the round's submissions and returns it to the waiting state.
    // Also used, behind a confirm step in the UI, to reopen an already-finalized
    // item — clearing `finalResult` so a stale range doesn't linger next to the
    // new round. Bumping `round` is what lets a participant that reconnects after
    // missing both the Reveal and this Retry tell the new round apart from the
    // old one (ADR-003, "Versioned rounds") — see `applySyncState`.
    patchItem(id, {
      submissions: [],
      revealed: false,
      round: item.round + 1,
      finalResult: null,
    })
  },

  applySyncState: (snapshot) =>
    set((state) => {
      const session = useSessionStore.getState()
      // Only a participant ever receives another client's broadcast (the
      // facilitator is the sole sender — see broadcastFacilitatorState); guarding
      // on role keeps a stray/self-received snapshot from ever overwriting the
      // facilitator's own sessionName field with an echo.
      if (useConnectionStore.getState().role === 'participant') {
        session.setSessionName(snapshot.sessionName)
      }
      // Participants estimate in the facilitator's unit, not their local default.
      session.setUnit(snapshot.unit)
      if (snapshot.currentItem === null) {
        return { liveRound: null }
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

  applyRemoteEstimate: (itemId, estimate, round) => {
    const session = useSessionStore.getState()
    // Facilitator-only: `sendEstimate` targets the facilitator alone, so a
    // participant never receives another peer's estimate (ADR-003, "Single
    // owner") and this handler is never invoked on a participant client.
    // Only record if this submission is for the item the round is running on
    // — a straggler for a just-finalized item must not seed the next round —
    // and only while that round is still open: a late submission must not
    // move a range the group has seen.
    const active = session.items.find((item) => item.id === session.activeItemId)
    if (
      !active ||
      // An empty itemId is a pre-#8 peer's bare estimate — record it against
      // the active round (legacy behaviour) rather than dropping it.
      (itemId && itemId !== active.id) ||
      active.revealed ||
      isFinalized(active) ||
      // A round mismatch means this submission belongs to a round the
      // participant hasn't caught up past yet (a stale in-flight send from
      // before a Retry). A missing `round` (older build) bypasses this
      // check rather than being treated as stale.
      (round !== undefined && round !== active.round)
    ) {
      return
    }
    patchItem(active.id, {
      submissions: upsertByParticipant(active.submissions, estimate),
    })
  },

  submitEstimate: (best, likely, worst) => {
    const { liveRound } = get()
    if (!liveRound) {
      return {
        ok: false,
        error:
          'There is no active round to estimate. Wait for the facilitator to start an item.',
      }
    }
    const { participantId } = useConnectionStore.getState()
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

  clearRound: () => set({ liveRound: null }),
}))

/** Upsert `next` into `list` keyed by participantId — last write wins, insertion
 *  order (and thus submission order) preserved for existing entries. */
function upsertByParticipant(list: Estimate[], next: Estimate): Estimate[] {
  const index = list.findIndex((e) => e.participantId === next.participantId)
  if (index === -1) return [...list, next]
  const copy = [...list]
  copy[index] = next
  return copy
}
