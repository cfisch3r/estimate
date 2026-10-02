import { useNavigate } from 'react-router'
import { ROUTES } from '../../../shared/lib/routes'
import { useSessionStore } from '../../../entities/session'

/** The workspace's active-item read-model plus the prev / advance moves between
 *  items. Both moves go to whichever item is adjacent in the sidebar's list order
 *  — not the next *pending* item. A first pass through a fresh backlog is
 *  unaffected (items are pending in list order anyway); revisiting an
 *  already-finalized item (via a direct click in the sidebar) and hitting "next"
 *  just moves to whatever's adjacent, with no separate "skip finalized" logic. */
export function useItemNavigation() {
  const items = useSessionStore((s) => s.items)
  const activeItemId = useSessionStore((s) => s.activeItemId)
  const selectItem = useSessionStore((s) => s.selectItem)
  const navigate = useNavigate()

  const activeIndex = items.findIndex((item) => item.id === activeItemId)
  const activeItem = activeIndex === -1 ? null : items[activeIndex]!
  const isFirst = activeIndex <= 0
  const isLast = activeIndex === items.length - 1
  const allFinalized =
    items.length > 0 && items.every((item) => item.finalResult !== null)

  function goPrev() {
    if (activeIndex <= 0) return
    selectItem(items[activeIndex - 1]!.id)
  }

  function advance() {
    if (activeIndex === -1) return
    if (activeIndex === items.length - 1) {
      // The item at activeIndex was just (re-)finalized by the caller — every
      // *other* item's finalResult already reflects its pre-click state, so
      // this check doesn't need a fresh read from the store.
      const allFinalizedNow = items.every(
        (item, idx) => idx === activeIndex || item.finalResult !== null,
      )
      if (allFinalizedNow) {
        // Nothing left to work on — clear the selection so returning to the
        // workspace (e.g. via Summary's "Back to item") shows the "all items
        // finalized" empty state instead of reopening this now-done item.
        selectItem(null)
      }
      navigate(ROUTES.summary)
    } else {
      selectItem(items[activeIndex + 1]!.id)
    }
  }

  return {
    itemCount: items.length,
    activeItem,
    isFirst,
    isLast,
    allFinalized,
    goPrev,
    advance,
  }
}
