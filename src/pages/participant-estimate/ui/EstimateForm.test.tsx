import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EstimateForm } from './EstimateForm'

describe('EstimateForm', () => {
  it('submits the parsed values once', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(() => ({ ok: true as const }))
    render(
      <EstimateForm
        unit="days"
        initial={{ best: 1, likely: 3, worst: 8 }}
        submitLabel="Submit estimate"
        onSubmit={onSubmit}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Submit estimate' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith(1, 3, 8)
    expect(screen.queryByText("Couldn't submit")).not.toBeInTheDocument()
  })

  it('shows a rejected submit under its own headline, announced as an alert', async () => {
    const user = userEvent.setup()
    render(
      <EstimateForm
        unit="days"
        initial={{ best: 1, likely: 3, worst: 8 }}
        submitLabel="Submit estimate"
        onSubmit={() => ({ ok: false, error: 'Round closed' })}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Submit estimate' }))

    expect(screen.getByText("Couldn't submit")).toBeInTheDocument()
    expect(screen.getByText('Round closed').closest('[role="alert"]')).not.toBeNull()
  })

  it('clears the error after a later successful submit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi
      .fn<() => { ok: true } | { ok: false; error: string }>()
      .mockReturnValueOnce({ ok: false, error: 'Round closed' })
      .mockReturnValueOnce({ ok: true })
    render(
      <EstimateForm
        unit="days"
        initial={{ best: 1, likely: 3, worst: 8 }}
        submitLabel="Submit estimate"
        onSubmit={onSubmit}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Submit estimate' }))
    await user.click(screen.getByRole('button', { name: 'Submit estimate' }))

    expect(screen.queryByText('Round closed')).not.toBeInTheDocument()
  })
})
