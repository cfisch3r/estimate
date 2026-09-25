import { useRef, useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { continueListOnEnter, indentListLine } from './markdownListEditing'

/** A minimal host wiring the two handlers to a real textarea the way
 *  Workspace's DescriptionField does, so the tests exercise real
 *  selectionStart/selectionEnd and keydown behavior rather than calling the
 *  pure functions with hand-built fixtures. */
function Host({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  return (
    <textarea
      aria-label="description"
      ref={textareaRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        const textarea = e.currentTarget
        if (e.key === 'Enter') {
          const next = continueListOnEnter(textarea, value)
          if (next !== null) {
            e.preventDefault()
            setValue(next)
          }
        } else if (e.key === 'Tab') {
          const next = indentListLine(textarea, value, e.shiftKey)
          if (next !== null) {
            e.preventDefault()
            setValue(next)
          }
        }
      }}
    />
  )
}

describe('continueListOnEnter (via Enter key)', () => {
  it('continues a bullet list onto a new line', async () => {
    const user = userEvent.setup()
    render(<Host initial="- first" />)
    const textarea = screen.getByLabelText('description') as HTMLTextAreaElement
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)

    await user.type(textarea, '{Enter}second')

    expect(textarea.value).toBe('- first\n- second')
  })

  it('exits the list when Enter is pressed on an empty item', async () => {
    const user = userEvent.setup()
    render(<Host initial={'- first\n- '} />)
    const textarea = screen.getByLabelText('description') as HTMLTextAreaElement
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)

    await user.type(textarea, '{Enter}plain text')

    expect(textarea.value).toBe('- first\n\nplain text')
  })

  it('preserves indent and bullet when continuing a nested item', async () => {
    const user = userEvent.setup()
    render(<Host initial="  - nested" />)
    const textarea = screen.getByLabelText('description') as HTMLTextAreaElement
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)

    await user.type(textarea, '{Enter}sibling')

    expect(textarea.value).toBe('  - nested\n  - sibling')
  })

  it('leaves a non-list line untouched (default Enter behavior applies)', async () => {
    const user = userEvent.setup()
    render(<Host initial="plain text" />)
    const textarea = screen.getByLabelText('description') as HTMLTextAreaElement
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)

    await user.type(textarea, '{Enter}more')

    expect(textarea.value).toBe('plain text\nmore')
  })
})

describe('indentListLine (via Tab key)', () => {
  it('indents a bullet line by two spaces', async () => {
    const user = userEvent.setup()
    render(<Host initial="- item" />)
    const textarea = screen.getByLabelText('description') as HTMLTextAreaElement
    textarea.setSelectionRange(0, 0)
    textarea.focus()

    await user.keyboard('{Tab}')

    expect(textarea.value).toBe('  - item')
  })

  it('outdents an indented bullet line with Shift+Tab', async () => {
    const user = userEvent.setup()
    render(<Host initial="  - item" />)
    const textarea = screen.getByLabelText('description') as HTMLTextAreaElement
    textarea.setSelectionRange(0, 0)
    textarea.focus()

    await user.keyboard('{Shift>}{Tab}{/Shift}')

    expect(textarea.value).toBe('- item')
  })

  it('does not trap Tab on a non-list line', async () => {
    const user = userEvent.setup()
    render(
      <>
        <Host initial="plain text" />
        <button>next control</button>
      </>,
    )
    const textarea = screen.getByLabelText('description') as HTMLTextAreaElement
    textarea.setSelectionRange(0, 0)
    textarea.focus()

    await user.keyboard('{Tab}')

    expect(textarea.value).toBe('plain text')
    expect(screen.getByRole('button', { name: 'next control' })).toHaveFocus()
  })
})
