import { useEffect, useId, useRef } from 'react'
import { XIcon } from '@phosphor-icons/react/dist/csr/X'
import { Button, CardKicker, Tag } from '../../../shared/ui'
import { useDiscardSession, useSessionStore } from '../../../application'
import { isFinalized } from '../../../domain/item'
import { useFocusHandoff } from '../model/focusHandoff'

/** What a loaded file holds, before a mode starts with it. Renders nothing
 *  while no file is loaded. */
export function LoadedSessionCard() {
  const loadedFrom = useSessionStore((s) => s.loadedFrom)
  const sessionName = useSessionStore((s) => s.sessionName)
  const unit = useSessionStore((s) => s.unit)
  const items = useSessionStore((s) => s.items)
  const discardSession = useDiscardSession()
  const { handFocusTo, takeFocus } = useFocusHandoff()
  const kickerId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    // Just loaded: the Load row that had focus is gone, so focus the result.
    if (loadedFrom !== null && takeFocus('loaded-session')) headingRef.current?.focus()
  }, [loadedFrom, takeFocus])

  if (loadedFrom === null) return null
  const finalized = items.filter(isFinalized).length

  return (
    // A Nocturne card, as a <section> so the preview is a named region.
    <section
      className="card elev-sm"
      aria-labelledby={kickerId}
      style={{ position: 'relative', gap: 'var(--space-2)', padding: 'var(--space-4)' }}
    >
      <CardKicker id={kickerId}>Loaded session</CardKicker>
      <h2
        ref={headingRef}
        tabIndex={-1}
        style={{ margin: 0, fontSize: 20, fontWeight: 500 }}
      >
        {sessionName || 'Unnamed session'}
      </h2>
      {/* After the heading in the DOM, so Tab from the focused heading reaches
          Discard first and the action follows the session it acts on; shown
          in the card's top corner. */}
      <Button
        variant="ghost"
        aria-label="Discard loaded session"
        style={{ position: 'absolute', top: 'var(--space-3)', right: 'var(--space-3)' }}
        onClick={() => {
          handFocusTo('load-row')
          discardSession()
        }}
      >
        <XIcon size={14} aria-hidden />
        Discard
      </Button>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <Tag variant="neutral">
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </Tag>
        <Tag variant="accent">{finalized} finalized</Tag>
        <Tag variant="neutral">Unit: {unit}</Tag>
      </div>
      {/* A solid neutral, not .text-muted, which is below AA on the card
          surface (see LoadRejectedAlert). */}
      <span style={{ fontSize: 11, color: 'var(--color-neutral-400)' }}>
        From {loadedFrom}
      </span>
    </section>
  )
}
