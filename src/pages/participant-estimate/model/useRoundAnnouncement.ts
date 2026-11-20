import { useEffect, useRef, useState } from 'react'
import type { LiveConnectionStatus } from '../../../domain/types'
import type { RoundView } from './useParticipantRound'

/** What a screen-reader user can't see happen when the screen changes state: the
 *  focused heading says which item this is, this says what changed about it. */
function announcementFor(
  view: RoundView,
  connectionStatus: LiveConnectionStatus,
  itemTitle: string,
): string {
  if (view === 'waiting') return 'Estimate submitted.'
  if (view === 'revealed') return 'Estimates revealed.'
  // Names the item, so moving between two finalized items is still news.
  if (view === 'finalized') return `${itemTitle} is already estimated.`
  if (view === 'lobby' && connectionStatus === 'connected') {
    return 'Connected. Waiting for the facilitator to start the first item.'
  }
  return ''
}

/** Announces a state change, not a state: arriving on the screen (or being
 *  restored into it by a reconnect) says nothing, so a submit that happened
 *  earlier isn't reported as news. Each finalized item is news of its own,
 *  so that view is keyed by item id. */
export function useRoundAnnouncement(
  view: RoundView,
  connectionStatus: LiveConnectionStatus,
  item: { id: string; title: string } | null = null,
): string {
  const itemTitle = item?.title ?? ''
  const key =
    view === 'lobby'
      ? `lobby:${connectionStatus}`
      : view === 'finalized'
        ? `finalized:${item?.id ?? ''}`
        : view
  const previousKey = useRef(key)
  const spoken = useRef('')
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    if (previousKey.current === key) return
    previousKey.current = key
    const next = announcementFor(view, connectionStatus, itemTitle)
    // A live region reads changes only: the same words twice in a row (two
    // finalized items with one title) would stay silent. Empty it first and
    // say them again on the next tick.
    const repeat = next !== '' && next === spoken.current
    spoken.current = next
    if (!repeat) {
      setAnnouncement(next)
      return
    }
    setAnnouncement('')
    const timer = setTimeout(() => setAnnouncement(next), 0)
    return () => clearTimeout(timer)
  }, [key, view, connectionStatus, itemTitle])

  return announcement
}
