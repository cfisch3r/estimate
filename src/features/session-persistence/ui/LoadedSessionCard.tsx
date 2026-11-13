import { XIcon } from '@phosphor-icons/react/dist/csr/X'
import { Button, CardKicker, Tag } from '../../../shared/ui'
import { useSessionStore } from '../../../application'
import { isFinalized } from '../../../domain/item'

interface LoadedSessionCardProps {
  fileName: string
  onDiscard: () => void
}

/** What a loaded file holds, before a mode starts with it. */
export function LoadedSessionCard({ fileName, onDiscard }: LoadedSessionCardProps) {
  const sessionName = useSessionStore((s) => s.sessionName)
  const unit = useSessionStore((s) => s.unit)
  const items = useSessionStore((s) => s.items)
  const finalized = items.filter(isFinalized).length

  return (
    // A Nocturne card, as a <section> so the preview is a named region.
    <section
      className="card elev-sm"
      aria-label="Loaded session"
      style={{ gap: 'var(--space-2)', padding: 'var(--space-4)' }}
    >
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <CardKicker>Loaded session</CardKicker>
        <Button variant="ghost" onClick={onDiscard}>
          <XIcon size={14} aria-hidden />
          Discard
        </Button>
      </div>
      <span style={{ fontSize: 20, fontWeight: 500 }}>
        {sessionName || 'Unnamed session'}
      </span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <Tag variant="neutral">
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </Tag>
        <Tag variant="accent">{finalized} finalized</Tag>
        <Tag variant="neutral">Unit: {unit}</Tag>
      </div>
      <span className="text-muted" style={{ fontSize: 11 }}>
        From {fileName}
      </span>
    </section>
  )
}
