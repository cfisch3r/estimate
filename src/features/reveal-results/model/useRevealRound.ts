import { useConnectionStore, useRevealActions } from '../../../application'
import type { ActionResult } from '../../../domain/estimate'
import type { Item } from '../../../domain/types'
import { buildFacilitatorRows, type FacilitatorRow } from '../lib/facilitatorRows'
import { revealPanelView, type RevealPanelView } from '../lib/revealPanelView'

interface RevealRound {
  /** Who the facilitator is waiting on, labelled, with submitted values. */
  roster: FacilitatorRow[]
  reveal: () => void
  retry: () => void
  finalize: () => ActionResult
  /** Finalize, and move on only if that worked. */
  finalizeAndAdvance: () => void
  /** What the panel shows for this item. */
  view: RevealPanelView
}

/** The facilitator's reveal panel model for one item: its labelled roster (a view
 *  built from the connection store's announced names) plus the application's
 *  reveal / retry / finalize actions bound to that item. */
export function useRevealRound(
  item: Item,
  onAdvance: () => void = () => {},
): RevealRound {
  const participantNames = useConnectionStore((s) => s.participantNames)
  const actions = useRevealActions(item.id)

  return {
    roster: buildFacilitatorRows(item, participantNames),
    ...actions,
    finalizeAndAdvance: () => {
      if (actions.finalize().ok) onAdvance()
    },
    view: revealPanelView(item),
  }
}
