import { useRef, useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MarkdownToolbar } from './MarkdownToolbar'

/** MarkdownToolbar is stateless — it mutates whatever value/onChange it's
 *  given — so a small host wires it to a real textarea + ref the way
 *  Workspace's DescriptionField does. */
function Host({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  return (
    <>
      <MarkdownToolbar textareaRef={textareaRef} value={value} onChange={setValue} />
      <textarea aria-label="description" ref={textareaRef} value={value} readOnly />
    </>
  )
}

describe('MarkdownToolbar', () => {
  it('wraps selected text in ** for bold', async () => {
    const user = userEvent.setup()
    render(<Host initial="hello" />)
    const textarea = screen.getByLabelText('description') as HTMLTextAreaElement
    textarea.setSelectionRange(0, 5)

    await user.click(screen.getByRole('button', { name: 'Bold' }))

    expect(textarea.value).toBe('**hello**')
  })

  it('inserts a placeholder when nothing is selected', async () => {
    const user = userEvent.setup()
    render(<Host initial="" />)
    const textarea = screen.getByLabelText('description') as HTMLTextAreaElement
    textarea.setSelectionRange(0, 0)

    await user.click(screen.getByRole('button', { name: 'Italic' }))

    expect(textarea.value).toBe('_italic text_')
  })

  it('prefixes the current line with a bullet', async () => {
    const user = userEvent.setup()
    render(<Host initial="first line" />)
    const textarea = screen.getByLabelText('description') as HTMLTextAreaElement
    textarea.setSelectionRange(5, 5)

    await user.click(screen.getByRole('button', { name: 'Bullet list' }))

    expect(textarea.value).toBe('- first line')
  })

  it('wraps a selection with markdown link syntax', async () => {
    const user = userEvent.setup()
    render(<Host initial="docs" />)
    const textarea = screen.getByLabelText('description') as HTMLTextAreaElement
    textarea.setSelectionRange(0, 4)

    await user.click(screen.getByRole('button', { name: 'Link' }))

    expect(textarea.value).toBe('[docs](https://)')
  })
})
