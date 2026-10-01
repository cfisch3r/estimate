import { useState } from 'react'
import { PencilSimpleIcon } from '@phosphor-icons/react/dist/csr/PencilSimple'
import { Input } from './Field'

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
        // Autofocus here moves focus in direct response to the user's own
        // click on the rename trigger below, not on page load — the
        // disorienting case the rule guards against doesn't apply.
        // oxlint-disable-next-line jsx-a11y/no-autofocus
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
    // The clickable control is a real <button> nested inside the <h1> (a
    // valid content model — headings may contain phrasing content like
    // buttons) so the title stays discoverable via heading navigation while
    // the rename trigger is a native, keyboard-operable control.
    <h1 style={{ margin: 0, fontSize: 22, textAlign: 'center' }}>
      <button
        type="button"
        onClick={() => {
          setDraft(value)
          setEditing(true)
        }}
        title="Click to rename"
        style={{
          background: 'none',
          border: 'none',
          margin: 0,
          padding: 0,
          font: 'inherit',
          fontWeight: 500,
          color: 'inherit',
          cursor: 'text',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
        }}
      >
        {value}
        <PencilSimpleIcon
          size={13}
          style={{ color: 'var(--color-neutral-500)', flex: 'none' }}
        />
      </button>
    </h1>
  )
}
