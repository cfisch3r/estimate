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
 *  earlier isn't reported as news. */
export function useRoundAnnouncement(
  view: RoundView,
  connectionStatus: LiveConnectionStatus,
  itemTitle = '',
): string {
  const key =
    view === 'lobby'
      ? `lobby:${connectionStatus}`
      : view === 'finalized'
        ? `finalized:${itemTitle}`
        : view
  const previousKey = useRef(key)
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    if (previousKey.current === key) return
    previousKey.current = key
    setAnnouncement(announcementFor(view, connectionStatus, itemTitle))
  }, [key, view, connectionStatus, itemTitle])

  return announcement
}
