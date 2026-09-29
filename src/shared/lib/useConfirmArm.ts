import { useCallback, useEffect, useRef, useState } from 'react'

const ARM_TIMEOUT_MS = 3000

/** Two-click confirm: the first click "arms" the control for `ARM_TIMEOUT_MS`; a second
 *  click while armed fires `onConfirm`. Arming clears on timeout or on any click outside
 *  the confirming element, so a misclick can't linger into a later, unrelated click. */
export function useConfirmArm<T extends HTMLElement = HTMLElement>(
  onConfirm: () => void,
) {
  const [armed, setArmed] = useState(false)
  const timeoutRef = useRef<number | null>(null)
  const elementRef = useRef<T | null>(null)

  const disarm = useCallback(() => {
    setArmed(false)
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!armed) return
    // The arming click's own event can still be bubbling toward `document`
    // when this effect runs (React flushes it inline, before the event
    // finishes propagating), which would otherwise have this listener
    // immediately disarm the click that just armed it. Ignoring clicks that
    // land inside the control itself fixes both that and genuine same-click
    // double-fires — only a click actually outside the control should disarm.
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        elementRef.current &&
        e.target instanceof Node &&
        elementRef.current.contains(e.target)
      ) {
        return
      }
      disarm()
    }
    document.addEventListener('click', handleOutsideClick)
    return () => document.removeEventListener('click', handleOutsideClick)
  }, [armed, disarm])

  useEffect(() => disarm, [disarm])

  function handleClick() {
    if (armed) {
      disarm()
      onConfirm()
      return
    }
    setArmed(true)
    timeoutRef.current = window.setTimeout(disarm, ARM_TIMEOUT_MS)
  }

  return { armed, handleClick, ref: elementRef }
}
