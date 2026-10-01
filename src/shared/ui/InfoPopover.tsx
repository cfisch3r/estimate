import { useEffect, useId, useRef } from 'react'
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
export function InfoPopover({
  label,
  open,
  onOpen,
  onClose,
  children,
}: InfoPopoverProps) {
  const containerRef = useRef<HTMLSpanElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const wasOpen = useRef(false)
  // Set right before onClose() so the focus effect below can tell an outside
  // click apart from Escape/re-toggle — only the latter two should force
  // focus back to the trigger (see that effect for why).
  const closedByOutsideClick = useRef(false)
  const triggerId = useId()

  useEffect(() => {
    if (!open) return
    function handleOutsideClick(e: MouseEvent) {
      if (
        containerRef.current &&
        e.target instanceof Node &&
        !containerRef.current.contains(e.target)
      ) {
        closedByOutsideClick.current = true
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

  // Move focus into the panel on open (there's no focusable content in any
  // current usage, so the panel itself is the target) and back to the
  // trigger on close — but only for Escape or a re-click of the trigger
  // itself, where nothing else claimed focus. An outside click already moved
  // focus to whatever the user clicked (that's the whole point of their
  // click); forcing it back to the trigger here would fight that and steal
  // focus from the element they meant to interact with next.
  useEffect(() => {
    if (open) {
      const panel = panelRef.current
      const focusable = panel?.querySelector<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      )
      ;(focusable ?? panel)?.focus()
    } else if (wasOpen.current && !closedByOutsideClick.current) {
      triggerRef.current?.focus()
    }
    wasOpen.current = open
    closedByOutsideClick.current = false
  }, [open])

  return (
    <span className="info-popover" ref={containerRef}>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        className="info-popover-trigger"
        aria-label={label}
        aria-expanded={open}
        onClick={() => (open ? onClose() : onOpen())}
      >
        <InfoIcon size={12} weight="bold" />
      </button>
      {open && (
        <div
          className="info-popover-panel"
          ref={panelRef}
          tabIndex={-1}
          // `fieldset` (oxlint's suggested native alternative to
          // role="group") is for grouping form controls — this panel holds
          // arbitrary descriptive content, so there's no better native tag.
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
          role="group"
          aria-labelledby={triggerId}
        >
          {children}
        </div>
      )}
    </span>
  )
}
