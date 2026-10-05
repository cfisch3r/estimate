import { useEffect, useRef, useState } from 'react'
import { GroupBox } from './GroupBox'
import { Textarea } from './Field'
import { Markdown } from './Markdown'
import { MarkdownToolbar } from './MarkdownToolbar'
import { continueListOnEnter, indentListLine } from './markdownListEditing'
import type { ReactNode } from 'react'

interface MarkdownEditorProps {
  /** Heading of the group box, and the textarea's accessible name. */
  label: string
  /** Content of the group box's click-to-open info popover. */
  info?: ReactNode
  value: string
  onChange: (next: string) => void
  infoOpen: boolean
  onInfoOpen: () => void
  onInfoClose: () => void
}

/** A markdown field with a write/preview toggle, formatting toolbar and
 *  list-continuation keys. Preview renders through the same `Markdown` component
 *  other views use, so what an editor sees here is exactly what readers will
 *  see — no separate rendering path to drift out of sync. A `GroupBox` like
 *  Phase/Range/etc. rather than a plain `Field`, so it reads as one of the
 *  surrounding screen's sections instead of sitting apart from them. */
export function MarkdownEditor({
  label,
  info,
  value,
  onChange,
  infoOpen,
  onInfoOpen,
  onInfoClose,
}: MarkdownEditorProps) {
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
      label={label}
      info={info}
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
              aria-label={label}
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
