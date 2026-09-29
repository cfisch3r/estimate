import { useState } from 'react'
import { PencilSimpleIcon } from '@phosphor-icons/react/dist/csr/PencilSimple'
import { Input } from '../../../shared/ui/Field'

interface EditableTitleProps {
  value: string
  onCommit: (next: string) => void
}

export function EditableTitle({ value, onCommit }: EditableTitleProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  function commit() {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed.length > 0 && trimmed !== value) {
      onCommit(trimmed)
    } else {
      setDraft(value)
    }
  }

  if (editing) {
    return (
      <Input
        autoFocus
        aria-label="Item title"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') {
            setDraft(value)
            setEditing(false)
          }
        }}
        style={{
          fontWeight: 500,
          fontSize: 22,
          textAlign: 'center',
          borderRadius: 'var(--radius-lg)',
        }}
      />
    )
  }

  return (
    <h1
      onClick={() => {
        setDraft(value)
        setEditing(true)
      }}
      title="Click to rename"
      style={{
        margin: 0,
        fontWeight: 500,
        fontSize: 22,
        textAlign: 'center',
        cursor: 'text',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-2)',
      }}
    >
      {value}
      <PencilSimpleIcon
        size={13}
        style={{ color: 'var(--color-neutral-500)', flex: 'none' }}
      />
    </h1>
  )
}
