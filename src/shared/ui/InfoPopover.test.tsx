import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { InfoPopover } from './InfoPopover'

// InfoPopover owns no state of its own — the caller drives `open` — so a
// small stateful wrapper exercises it the way every real call site does.
function ControlledInfoPopover() {
  const [open, setOpen] = useState(false)
  return (
    <InfoPopover
      label="About this field"
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
    >
      <p>Helpful detail about this field.</p>
    </InfoPopover>
  )
}

describe('InfoPopover', () => {
  it('has no axe violations closed or open', async () => {
    const user = userEvent.setup()
    const { container } = render(<ControlledInfoPopover />)

    expect(await axe(container)).toHaveNoViolations()

    await user.click(screen.getByRole('button', { name: 'About this field' }))
    expect(await axe(container)).toHaveNoViolations()
  })

  it('moves focus into the panel on open and back to the trigger on close', async () => {
    const user = userEvent.setup()
    render(<ControlledInfoPopover />)

    const trigger = screen.getByRole('button', { name: 'About this field' })
    await user.click(trigger)

    expect(
      screen.getByText('Helpful detail about this field.').parentElement,
    ).toHaveFocus()

    await user.keyboard('{Escape}')

    await waitFor(() => expect(trigger).toHaveFocus())
    expect(screen.queryByText('Helpful detail about this field.')).not.toBeInTheDocument()
  })

  it('returns focus to the trigger on an outside click too', async () => {
    const user = userEvent.setup()
    render(
      <>
        <ControlledInfoPopover />
        <button type="button">elsewhere</button>
      </>,
    )

    const trigger = screen.getByRole('button', { name: 'About this field' })
    await user.click(trigger)
    await user.click(screen.getByRole('button', { name: 'elsewhere' }))

    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('does not call onOpen/onClose more than once per toggle', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    const onClose = vi.fn()
    render(
      <InfoPopover
        label="About this field"
        open={false}
        onOpen={onOpen}
        onClose={onClose}
      >
        <p>Detail.</p>
      </InfoPopover>,
    )

    await user.click(screen.getByRole('button', { name: 'About this field' }))

    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })
})
