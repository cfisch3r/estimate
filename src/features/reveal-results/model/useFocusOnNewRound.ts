import { useEffect, useRef } from 'react'
import { isNewRound } from '../../../domain/round'

/** A ref that takes focus when the item starts a new round. Retry and Reopen
 *  unmount the footer button that had focus (the pre-reveal footer's Reveal
 *  button is disabled with no submissions), which would drop focus to
 *  <body>; attach the ref to an element that is on screen in every state. */
export function useFocusOnNewRound<T extends HTMLElement>(item: {
  id: string
  round: number
}) {
  const ref = useRef<T>(null)
  const previous = useRef({ itemId: item.id, round: item.round })
  useEffect(() => {
    const current = { itemId: item.id, round: item.round }
    const was = previous.current
    previous.current = current
    if (isNewRound(was, current)) ref.current?.focus()
  }, [item.id, item.round])
  return ref
}
