import { create } from 'zustand'
import type { AggregateResult, Estimate } from '../../domain/estimate'
import {
  acceptRemoteEstimate,
  adoptSnapshot,
  recordOwnSubmission,
  retryRoundPatch,
} from '../../domain/round'
import { patchItem, useSessionStore } from './session'
import type { LiveRound, SessionSnapshot } from '../../domain/types'

export interface RoundStore {
  /** Participant-only view of the facilitator's current round; null otherwise. */
  liveRound: LiveRound | null

  /** Record an already-computed aggregate as item `id`'s final result. The
   *  caller (the finalize use case) validates and aggregates; this store only
   *  holds state. */
  finalizeItem: (id: string, finalResult: AggregateResult) => void
  /** Facilitator: reveal the current round's estimates for `id` (1c -> 1d). */
  revealRound: (id: string) => void
  /** Facilitator: discard this item's submissions and drop back to the waiting
   *  state (1d -> 1c) so participants estimate the item again. */
  retryRound: (id: string) => void
  /** Participant: adopt the round part of the facilitator's broadcast state. Use
   *  `applyFacilitatorSnapshot` to apply a whole snapshot (name and unit too). */
  applyRoundSnapshot: (snapshot: SessionSnapshot) => void
  /** Facilitator only: record an incoming targeted submission for `itemId`
   *  into that item's `submissions`. A submission whose `itemId` isn't the
   *  active item is dropped, and so is one whose `round` doesn't match the
   *  active item's round. Participants never receive another peer's estimate
   *  — `sendEstimate` targets the facilitator only (ADR-003, "Single owner") —
   *  so there is no participant-side handling here. */
  applyRemoteEstimate: (itemId: string, estimate: Estimate, round?: number) => void
  /** Participant: record this client's own (already valid) estimate for the
   *  round. No-op when there is no active round. */
  submitEstimate: (estimate: Estimate) => void
  /** Drop the participant-side round view. Composed alongside `connection.ts`'s
   *  `leaveLiveSession`/`joinLiveSession` by the `useLeaveLiveSession` /
   *  `useJoinLiveSession` composer use cases (`application/useCases`), not
   *  called from those actions directly: the stores stay independent of each
   *  other (see ADR-005). */
  clearRound: () => void
}

export const useRoundStore = create<RoundStore>((set) => ({
  liveRound: null,

  finalizeItem: (id, finalResult) => patchItem(id, { finalResult }),

  revealRound: (id) => patchItem(id, { revealed: true }),

  retryRound: (id) => {
    const item = useSessionStore.getState().items.find((i) => i.id === id)
    if (!item) return
    patchItem(id, retryRoundPatch(item))
  },

  applyRoundSnapshot: (snapshot) =>
    set((state) => ({ liveRound: adoptSnapshot(state.liveRound, snapshot) })),

  applyRemoteEstimate: (itemId, estimate, round) => {
    const session = useSessionStore.getState()
    const active = session.items.find((item) => item.id === session.activeItemId)
    const submissions = acceptRemoteEstimate(active, itemId, estimate, round)
    if (active && submissions) patchItem(active.id, { submissions })
  },

  submitEstimate: (estimate) =>
    set((state) => {
      const liveRound = recordOwnSubmission(state.liveRound, estimate)
      return liveRound ? { liveRound } : {}
    }),

  clearRound: () => set({ liveRound: null }),
}))
