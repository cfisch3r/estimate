import { useCallback, useEffect, useRef, useState } from 'react'

const ARM_TIMEOUT_MS = 3000

/** Two-click confirm: the first click "arms" the control for `ARM_TIMEOUT_MS`; a second
 *  click while armed fires `onConfirm`. Arming clears on timeout or on any click outside
 *  the confirming element, so a misclick can't linger into a later, unrelated click. */
export function useConfirmArm(onConfirm: () => void) {
  const [armed, setArmed] = useState(false)
  const timeoutRef = useRef<number | null>(null)

  const disarm = useCallback(() => {
    setArmed(false)
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!armed) return
    document.addEventListener('click', disarm)
    return () => document.removeEventListener('click', disarm)
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

  return { armed, handleClick }
}
