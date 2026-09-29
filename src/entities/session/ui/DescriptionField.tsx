import { useEffect, useRef, useState } from 'react'
import { GroupBox } from '../../../shared/ui/GroupBox'
import { Textarea } from '../../../shared/ui/Field'
import { Markdown } from '../../../shared/ui/Markdown'
import { MarkdownToolbar } from '../../../shared/ui/MarkdownToolbar'
import {
  continueListOnEnter,
  indentListLine,
} from '../../../shared/ui/markdownListEditing'
import { DESCRIPTION_INFO } from '../../../shared/copy'

interface DescriptionFieldProps {
  value: string
  onChange: (next: string) => void
  infoOpen: boolean
  onInfoOpen: () => void
  onInfoClose: () => void
}

/** The description field's write/preview toggle. Preview renders through the
 *  same `Markdown` component the participant view uses, so what the
 *  facilitator sees here is exactly what participants will see — no separate
 *  rendering path to drift out of sync. A `GroupBox` like Phase/Range/etc.
 *  rather than a plain `Field`, so it reads as one of the item's sections
 *  instead of sitting apart from them. */
export function DescriptionField({
  value,
  onChange,
  infoOpen,
  onInfoOpen,
  onInfoClose,
}: DescriptionFieldProps) {
  const [mode, setMode] = useState<'write' | 'preview'>('write')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Grows the textarea to fit its content (up to the CSS max-height, past
  // which it scrolls) rather than a fixed row count — re-measuring on every
  // value change, and whenever the field becomes visible again after a
  // Preview round-trip, so switching back to Write always shows the full
  // text sized correctly rather than the write-mode default.
  useEffect(() => {
    const textarea = textareaRef.current
    if (mode !== 'write' || !textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [value, mode])

  return (
    <GroupBox
      label="Description"
      info={DESCRIPTION_INFO}
      infoOpen={infoOpen}
      onInfoOpen={onInfoOpen}
      onInfoClose={onInfoClose}
    >
      <div className="md-tabs">
        <button
          type="button"
          className={['md-tab', mode === 'write' && 'md-tab--active']
            .filter(Boolean)
            .join(' ')}
          onClick={() => setMode('write')}
        >
          Write
        </button>
        <button
          type="button"
          className={['md-tab', mode === 'preview' && 'md-tab--active']
            .filter(Boolean)
            .join(' ')}
          onClick={() => setMode('preview')}
        >
          Preview
        </button>
      </div>
      <div className="md-panel">
        {mode === 'write' ? (
          <>
            <MarkdownToolbar
              textareaRef={textareaRef}
              value={value}
              onChange={onChange}
            />
            <Textarea
              aria-label="Description"
              ref={textareaRef}
              className="textarea-autosize"
              rows={3}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                const textarea = e.currentTarget
                if (e.key === 'Enter') {
                  const next = continueListOnEnter(textarea, value)
                  if (next !== null) {
                    e.preventDefault()
                    onChange(next)
                  }
                } else if (e.key === 'Tab') {
                  const next = indentListLine(textarea, value, e.shiftKey)
                  if (next !== null) {
                    e.preventDefault()
                    onChange(next)
                  }
                }
              }}
            />
          </>
        ) : value ? (
          <Markdown content={value} className="markdown-preview" />
        ) : (
          <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
            Nothing to preview yet.
          </p>
        )}
      </div>
    </GroupBox>
  )
}
