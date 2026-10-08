import type { ActionResult } from '../../domain/estimate'
import { useRoundStore, useSessionStore } from '../stores'
import { finalizeWith } from './finalizeWith'

interface RevealActions {
  reveal: () => void
  retry: () => void
  finalize: () => ActionResult
}

/** The facilitator's reveal use case for one item: the reveal / retry / finalize
 *  actions bound to it.
 *
 *  Reveal and Retry are local store mutations only — the store subscription in
 *  `NetworkProvider` broadcasts the resulting snapshot (revealed / round changed)
 *  to participants, so there is no separate wire event to send from here.
 *
 *  Finalize aggregates the round's collected submissions here, then hands the
 *  store the computed result — the store only holds state. */
export function useRevealActions(itemId: string): RevealActions {
  const revealRound = useRoundStore((s) => s.revealRound)
  const retryRound = useRoundStore((s) => s.retryRound)

  return {
    reveal: () => revealRound(itemId),
    retry: () => retryRound(itemId),
    finalize: () => {
      // Read the item at call time, not from the render closure, so a
      // submission that landed since the last render is still aggregated.
      const current = useSessionStore.getState().items.find((i) => i.id === itemId)
      if (!current) return { ok: false, error: 'Unknown item.' }
      return finalizeWith(current.id, current.submissions)
    },
  }
}
