import { useNavigate } from 'react-router'
import { ROUTES } from '../../../shared/lib/routes'
import { useSessionStore } from '../../../application'
import { isFinalized } from '../../../domain/item'
import { advanceFrom, previousItemId } from '../../../domain/navigation'

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
  const allFinalized = items.length > 0 && items.every(isFinalized)

  function goPrev() {
    const previous = previousItemId(items, activeIndex)
    if (previous !== null) selectItem(previous)
  }

  function advance() {
    const move = advanceFrom(items, activeIndex)
    if (move.kind === 'none') return
    if (move.kind === 'select') {
      selectItem(move.itemId)
      return
    }
    if (move.clearSelection) selectItem(null)
    navigate(ROUTES.summary)
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
