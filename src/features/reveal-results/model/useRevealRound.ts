import { finalResultFor } from '../../../entities/session'
import {
  useConnectionStore,
  useRoundStore,
  useSessionStore,
  type ActionResult,
  type Item,
} from '../../../entities/session'
import { buildFacilitatorRows, type FacilitatorRow } from '../lib/facilitatorRows'

interface RevealRound {
  /** Who the facilitator is waiting on, labelled, with submitted values. */
  roster: FacilitatorRow[]
  reveal: () => void
  retry: () => void
  finalize: () => ActionResult
}

/** The facilitator's reveal use case for one item: its labelled roster and the
 *  reveal / retry / finalize actions bound to that item.
 *
 *  Reveal and Retry are local store mutations only — the store subscription in
 *  `NetworkProvider` broadcasts the resulting snapshot (revealed / round changed)
 *  to participants, so there is no separate wire event to send from here.
 *
 *  Finalize aggregates the round's collected submissions here, then hands the
 *  store the computed result — the store only holds state. */
export function useRevealRound(item: Item): RevealRound {
  const participantNames = useConnectionStore((s) => s.participantNames)
  const revealRound = useRoundStore((s) => s.revealRound)
  const retryRound = useRoundStore((s) => s.retryRound)
  const finalizeItem = useRoundStore((s) => s.finalizeItem)

  return {
    roster: buildFacilitatorRows(item, participantNames),
    reveal: () => revealRound(item.id),
    retry: () => retryRound(item.id),
    finalize: () => {
      // Read the item at call time, not from the render closure, so a
      // submission that landed since the last render is still aggregated.
      const current = useSessionStore.getState().items.find((i) => i.id === item.id)
      if (!current) return { ok: false, error: 'Unknown item.' }
      const result = finalResultFor(current.submissions)
      if (!result.ok) return result
      finalizeItem(current.id, result.value)
      return { ok: true }
    },
  }
}
