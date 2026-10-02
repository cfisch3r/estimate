import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThreePointEstimateForm } from './ThreePointEstimateForm'

const info = { openKey: null, open: vi.fn(), close: vi.fn() }

describe('ThreePointEstimateForm', () => {
  it('shows the range placeholder until the estimate is valid', () => {
    render(
      <ThreePointEstimateForm
        unit="days"
        initial={null}
        info={info}
        footer={() => null}
      />,
    )

    expect(screen.getByText(/Enter best, most likely and worst case/)).toBeInTheDocument()
  })

  it('hands the footer validity and parsed values once all fields are filled', async () => {
    const user = userEvent.setup()
    const footer = vi.fn(() => null)
    render(
      <ThreePointEstimateForm unit="days" initial={null} info={info} footer={footer} />,
    )

    await user.type(screen.getByLabelText(/Best case/), '1')
    await user.type(screen.getByLabelText(/Most likely/), '3')
    await user.type(screen.getByLabelText(/Worst case/), '8')

    expect(footer).toHaveBeenLastCalledWith({
      valid: true,
      best: 1,
      likely: 3,
      worst: 8,
    })
    expect(
      screen.queryByText(/Enter best, most likely and worst case/),
    ).not.toBeInTheDocument()
  })

  it('shows an extra error from the caller in the banner', () => {
    render(
      <ThreePointEstimateForm
        unit="days"
        initial={{ best: 1, likely: 3, worst: 8 }}
        info={info}
        error="Round closed"
        footer={() => null}
      />,
    )

    expect(screen.getByText('Check your estimate')).toBeInTheDocument()
    expect(screen.getByText('Round closed')).toBeInTheDocument()
  })
})
