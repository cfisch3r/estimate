import {
  useConnectionStore,
  useRoundStore,
  type FinalizeResult,
  type Item,
} from '../../../entities/session'
import { buildRoster, type FacilitatorRosterRow } from '../lib/roster'

interface RevealRound {
  /** Who the facilitator is waiting on, labelled, with submitted values. */
  roster: FacilitatorRosterRow[]
  reveal: () => void
  retry: () => void
  finalize: () => FinalizeResult
}

/** The facilitator's reveal use case for one item: its labelled roster and the
 *  reveal / retry / finalize actions bound to that item.
 *
 *  Reveal and Retry are local store mutations only — the store subscription in
 *  `NetworkProvider` broadcasts the resulting snapshot (revealed / round changed)
 *  to participants, so there is no separate wire event to send from here. */
export function useRevealRound(item: Item): RevealRound {
  const participantNames = useConnectionStore((s) => s.participantNames)
  const revealRound = useRoundStore((s) => s.revealRound)
  const retryRound = useRoundStore((s) => s.retryRound)
  const finalizeLiveItem = useRoundStore((s) => s.finalizeLiveItem)

  return {
    roster: buildRoster(item, participantNames),
    reveal: () => revealRound(item.id),
    retry: () => retryRound(item.id),
    finalize: () => finalizeLiveItem(item.id),
  }
}
