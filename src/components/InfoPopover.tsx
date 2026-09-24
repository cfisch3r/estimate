import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { InfoIcon } from '@phosphor-icons/react/dist/csr/Info'

interface InfoPopoverProps {
  label: string
  open: boolean
  onOpen: () => void
  onClose: () => void
  children: ReactNode
}

/** Click-to-open (not hover) info popover, anchored to its trigger icon.
 *  Closes on an outside click or Escape. Open/closed state is owned by the
 *  caller so a screen can keep at most one popover open at a time. */
export function InfoPopover({ label, open, onOpen, onClose, children }: InfoPopoverProps) {
  const containerRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    function handleOutsideClick(e: MouseEvent) {
      if (
        containerRef.current &&
        e.target instanceof Node &&
        !containerRef.current.contains(e.target)
      ) {
        onClose()
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    // Capture phase, not bubble: clicking a *different* group's trigger while
    // this one is open must close this one before that trigger's own (bubble-
    // phase, React-attached) click handler opens the other — otherwise this
    // still-mounted listener fires after and nulls out the key the other
    // trigger just set, closing both instead of switching.
    document.addEventListener('click', handleOutsideClick, true)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('click', handleOutsideClick, true)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  return (
    <span className="info-popover" ref={containerRef}>
      <button
        type="button"
        className="info-popover-trigger"
        aria-label={label}
        aria-expanded={open}
        onClick={() => (open ? onClose() : onOpen())}
      >
        <InfoIcon size={12} weight="bold" />
      </button>
      {open && (
        <div className="info-popover-panel" role="tooltip">
          {children}
        </div>
      )}
    </span>
  )
}
