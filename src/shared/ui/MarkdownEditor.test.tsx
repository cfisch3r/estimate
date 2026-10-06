import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { MarkdownEditor } from './MarkdownEditor'

function Host({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial)
  return (
    <MarkdownEditor
      label="Notes"
      info="About notes"
      value={value}
      onChange={setValue}
      infoOpen={false}
      onInfoOpen={() => {}}
      onInfoClose={() => {}}
    />
  )
}

describe('MarkdownEditor', () => {
  it('has no axe violations in Write or Preview mode', async () => {
    const user = userEvent.setup()
    const { container } = render(<Host initial="**bold**" />)
    const options = { rules: { 'color-contrast': { enabled: false } } }

    expect(await axe(container, options)).toHaveNoViolations()

    await user.click(screen.getByRole('button', { name: 'Preview' }))
    expect(await axe(container, options)).toHaveNoViolations()
  })

  it('exposes the Write/Preview mode as aria-pressed', async () => {
    const user = userEvent.setup()
    render(<Host />)
    const write = screen.getByRole('button', { name: 'Write' })
    const preview = screen.getByRole('button', { name: 'Preview' })

    expect(write).toHaveAttribute('aria-pressed', 'true')
    expect(preview).toHaveAttribute('aria-pressed', 'false')

    await user.click(preview)

    expect(write).toHaveAttribute('aria-pressed', 'false')
    expect(preview).toHaveAttribute('aria-pressed', 'true')
  })

  it('labels the group and the textarea with the given label', () => {
    render(<Host />)
    expect(screen.getByRole('textbox', { name: 'Notes' })).toBeInTheDocument()
    expect(screen.getByText('Notes')).toBeInTheDocument()
  })

  it('continues a list when Enter is pressed at the end of a list line', async () => {
    const user = userEvent.setup()
    render(<Host initial="- one" />)
    const textarea = screen.getByRole('textbox', { name: 'Notes' })
    await user.click(textarea)
    await user.keyboard('{End}{Enter}two')
    expect(textarea).toHaveValue('- one\n- two')
  })

  it('previews the rendered markdown, or a placeholder when empty', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<Host initial="**bold**" />)
    await user.click(screen.getByRole('button', { name: 'Preview' }))
    expect(screen.getByText('bold').tagName).toBe('STRONG')
    unmount()

    render(<Host />)
    await user.click(screen.getByRole('button', { name: 'Preview' }))
    expect(screen.getByText('Nothing to preview yet.')).toBeInTheDocument()
  })
})
