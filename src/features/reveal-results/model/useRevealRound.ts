import { useConnectionStore, useRevealActions } from '../../../application'
import type { ActionResult } from '../../../domain/estimate'
import type { Item } from '../../../domain/types'
import { buildFacilitatorRows, type FacilitatorRow } from '../lib/facilitatorRows'

interface RevealRound {
  /** Who the facilitator is waiting on, labelled, with submitted values. */
  roster: FacilitatorRow[]
  reveal: () => void
  retry: () => void
  finalize: () => ActionResult
}

/** The facilitator's reveal panel model for one item: its labelled roster (a view
 *  built from the connection store's announced names) plus the application's
 *  reveal / retry / finalize actions bound to that item. */
export function useRevealRound(item: Item): RevealRound {
  const participantNames = useConnectionStore((s) => s.participantNames)
  const actions = useRevealActions(item.id)

  return { roster: buildFacilitatorRows(item, participantNames), ...actions }
}
