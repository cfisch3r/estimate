import type { RefObject } from 'react'
import { TextBIcon } from '@phosphor-icons/react/dist/csr/TextB'
import { TextItalicIcon } from '@phosphor-icons/react/dist/csr/TextItalic'
import { ListBulletsIcon } from '@phosphor-icons/react/dist/csr/ListBullets'
import { LinkIcon } from '@phosphor-icons/react/dist/csr/Link'
import { Button } from './Button'

interface MarkdownToolbarProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>
  value: string
  onChange: (next: string) => void
}

interface WrapAction {
  before: string
  after: string
  placeholder: string
}

/** Wraps the current selection in `before`/`after` (or inserts `placeholder`
 *  between them with no selection), then restores focus with the cursor left
 *  around the affected text so typing continues naturally. */
function wrapSelection(
  textarea: HTMLTextAreaElement,
  value: string,
  { before, after, placeholder }: WrapAction,
): string {
  const start = textarea.selectionStart ?? value.length
  const end = textarea.selectionEnd ?? value.length
  const selected = value.slice(start, end)
  const inner = selected || placeholder
  const next = value.slice(0, start) + before + inner + after + value.slice(end)

  requestAnimationFrame(() => {
    textarea.focus()
    const selectionStart = start + before.length
    const selectionEnd = selectionStart + inner.length
    textarea.setSelectionRange(selectionStart, selectionEnd)
  })

  return next
}

/** Inserts `prefix` at the start of the line(s) the selection touches — used
 *  for the bullet-list button, which acts on whole lines rather than wrapping
 *  inline text like bold/italic/link do. */
function prefixLines(
  textarea: HTMLTextAreaElement,
  value: string,
  prefix: string,
): string {
  const start = textarea.selectionStart ?? value.length
  const end = textarea.selectionEnd ?? value.length
  const lineStart = value.lastIndexOf('\n', start - 1) + 1
  const nextNewline = value.indexOf('\n', end)
  const lineEnd = nextNewline === -1 ? value.length : nextNewline + 1
  const block = value.slice(lineStart, lineEnd)
  const prefixed =
    block
      .split('\n')
      .map((line, i, lines) =>
        i === lines.length - 1 && line === '' ? line : `${prefix}${line}`,
      )
      .join('\n') || `${prefix}`
  const next = value.slice(0, lineStart) + prefixed + value.slice(lineEnd)

  requestAnimationFrame(() => {
    textarea.focus()
    textarea.setSelectionRange(lineStart, lineStart + prefixed.length)
  })

  return next
}

/** A small formatting button row above a markdown textarea. Buttons wrap or
 *  insert markdown syntax at the current selection rather than opening any
 *  rich-text UI — the textarea's value stays plain markdown text throughout. */
export function MarkdownToolbar({ textareaRef, value, onChange }: MarkdownToolbarProps) {
  function apply(mutate: (textarea: HTMLTextAreaElement, value: string) => string) {
    const textarea = textareaRef.current
    if (!textarea) return
    onChange(mutate(textarea, value))
  }

  return (
    <div className="markdown-toolbar">
      <Button
        icon
        type="button"
        variant="ghost"
        aria-label="Bold"
        onClick={() =>
          apply((textarea, val) =>
            wrapSelection(textarea, val, {
              before: '**',
              after: '**',
              placeholder: 'bold text',
            }),
          )
        }
      >
        <TextBIcon size={15} weight="bold" />
      </Button>
      <Button
        icon
        type="button"
        variant="ghost"
        aria-label="Italic"
        onClick={() =>
          apply((textarea, val) =>
            wrapSelection(textarea, val, {
              before: '_',
              after: '_',
              placeholder: 'italic text',
            }),
          )
        }
      >
        <TextItalicIcon size={15} weight="bold" />
      </Button>
      <Button
        icon
        type="button"
        variant="ghost"
        aria-label="Bullet list"
        onClick={() => apply((textarea, val) => prefixLines(textarea, val, '- '))}
      >
        <ListBulletsIcon size={15} weight="bold" />
      </Button>
      <Button
        icon
        type="button"
        variant="ghost"
        aria-label="Link"
        onClick={() =>
          apply((textarea, val) =>
            wrapSelection(textarea, val, {
              before: '[',
              after: '](https://)',
              placeholder: 'link text',
            }),
          )
        }
      >
        <LinkIcon size={15} weight="bold" />
      </Button>
    </div>
  )
}
