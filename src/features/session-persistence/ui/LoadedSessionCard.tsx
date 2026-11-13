import { useEffect, useId, useRef } from 'react'
import { XIcon } from '@phosphor-icons/react/dist/csr/X'
import { Button, CardKicker, Tag } from '../../../shared/ui'
import { useDiscardSession, useSessionStore } from '../../../application'
import { isFinalized } from '../../../domain/item'
import { handFocusTo, takeFocus } from '../model/focusHandoff'

/** What a loaded file holds, before a mode starts with it. Renders nothing
 *  while no file is loaded. */
export function LoadedSessionCard() {
  const loadedFrom = useSessionStore((s) => s.loadedFrom)
  const sessionName = useSessionStore((s) => s.sessionName)
  const unit = useSessionStore((s) => s.unit)
  const items = useSessionStore((s) => s.items)
  const discardSession = useDiscardSession()
  const kickerId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    // Just loaded: the Load row that had focus is gone, so focus the result.
    if (loadedFrom !== null && takeFocus('loaded-session')) headingRef.current?.focus()
  }, [loadedFrom])

  if (loadedFrom === null) return null
  const finalized = items.filter(isFinalized).length

  return (
    // A Nocturne card, as a <section> so the preview is a named region.
    <section
      className="card elev-sm"
      aria-labelledby={kickerId}
      style={{ gap: 'var(--space-2)', padding: 'var(--space-4)' }}
    >
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <CardKicker id={kickerId}>Loaded session</CardKicker>
        <Button
          variant="ghost"
          aria-label="Discard loaded session"
          onClick={() => {
            handFocusTo('load-row')
            discardSession()
          }}
        >
          <XIcon size={14} aria-hidden />
          Discard
        </Button>
      </div>
      <h2
        ref={headingRef}
        tabIndex={-1}
        style={{ margin: 0, fontSize: 20, fontWeight: 500 }}
      >
        {sessionName || 'Unnamed session'}
      </h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <Tag variant="neutral">
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </Tag>
        <Tag variant="accent">{finalized} finalized</Tag>
        <Tag variant="neutral">Unit: {unit}</Tag>
      </div>
      <span className="text-muted" style={{ fontSize: 11 }}>
        From {loadedFrom}
      </span>
    </section>
  )
}
