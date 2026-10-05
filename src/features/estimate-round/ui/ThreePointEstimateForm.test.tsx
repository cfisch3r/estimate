import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { ISSUE_SETTLE_MS } from '../model/useSettledIssue'
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

  it("shows the caller's own error under its own headline while the draft is valid", () => {
    render(
      <ThreePointEstimateForm
        unit="days"
        initial={{ best: 1, likely: 3, worst: 8 }}
        info={info}
        error="Round closed"
        footer={() => null}
      />,
    )

    expect(screen.getByText("Couldn't submit")).toBeInTheDocument()
    expect(screen.getByText('Round closed')).toBeInTheDocument()
  })

  it('explains an invalid entry and marks only the offending inputs', async () => {
    const user = userEvent.setup()
    render(
      <ThreePointEstimateForm
        unit="days"
        initial={null}
        info={info}
        footer={() => null}
      />,
    )

    await user.type(screen.getByLabelText(/Best case/), '8')
    await user.type(screen.getByLabelText(/Most likely/), '5')
    await user.type(screen.getByLabelText(/Worst case/), '9')

    const banner = screen.getByText(/Best case \(8 days\) is higher than Most likely/)
    expect(screen.getByText('Out of order')).toBeInTheDocument()
    expect(banner).toBeInTheDocument()
    const best = screen.getByLabelText(/Best case/)
    const likely = screen.getByLabelText(/Most likely/)
    const worst = screen.getByLabelText(/Worst case/)
    expect(best).toHaveAttribute('aria-invalid', 'true')
    expect(likely).toHaveAttribute('aria-invalid', 'true')
    expect(worst).not.toHaveAttribute('aria-invalid')
    expect(best).toHaveAccessibleDescription(/Best case \(8 days\) is higher/)
  })

  it('has no axe violations while an entry is invalid', async () => {
    const { container } = render(
      <ThreePointEstimateForm
        unit="days"
        initial={{ best: 8, likely: 5, worst: 9 }}
        info={info}
        footer={() => null}
      />,
    )

    // color-contrast needs real layout jsdom doesn't provide; see ADR-008.
    expect(
      await axe(container, { rules: { 'color-contrast': { enabled: false } } }),
    ).toHaveNoViolations()
  })

  it('announces validation banners through live regions', async () => {
    const user = userEvent.setup()
    render(
      <ThreePointEstimateForm
        unit="days"
        initial={null}
        info={info}
        error="Round closed"
        footer={() => null}
      />,
    )

    await user.type(screen.getByLabelText(/Best case/), '8')
    await user.type(screen.getByLabelText(/Most likely/), '5')

    // The entry settles before the problem is shown.
    const nudge = await screen.findByText(
      /Best case \(8 days\) is higher than Most likely/,
    )
    expect(nudge.closest('[role="status"]')).not.toBeNull()
  })

  it("announces the caller's error as an alert", () => {
    render(
      <ThreePointEstimateForm
        unit="days"
        initial={{ best: 1, likely: 3, worst: 8 }}
        info={info}
        error="Round closed"
        footer={() => null}
      />,
    )

    expect(screen.getByText('Round closed').closest('[role="alert"]')).not.toBeNull()
  })

  it('links the rounding note to its input', async () => {
    const user = userEvent.setup()
    render(
      <ThreePointEstimateForm
        unit="days"
        initial={null}
        info={info}
        footer={() => null}
      />,
    )

    await user.type(screen.getByLabelText(/Best case/), '1.3')

    expect(screen.getByLabelText(/Best case/)).toHaveAccessibleDescription(
      'Consider rounding to a meaningful value.',
    )
  })

  it('does not flash a problem while typing through an intermediate value', async () => {
    const user = userEvent.setup()
    render(
      <ThreePointEstimateForm
        unit="days"
        initial={null}
        info={info}
        footer={() => null}
      />,
    )

    await user.type(screen.getByLabelText(/Best case/), '5')
    const likely = screen.getByLabelText(/Most likely/)
    await user.type(likely, '1')
    // "1" is below the best case of 5, but only on the way to "15".
    expect(screen.queryByText(/is higher than/)).not.toBeInTheDocument()
    expect(likely).not.toHaveAttribute('aria-invalid')

    await user.type(likely, '5')
    await new Promise((resolve) => setTimeout(resolve, ISSUE_SETTLE_MS + 100))

    expect(screen.queryByText(/is higher than/)).not.toBeInTheDocument()
  })

  it('shows a pending problem at once when the field loses focus', async () => {
    const user = userEvent.setup()
    render(
      <ThreePointEstimateForm
        unit="days"
        initial={null}
        info={info}
        footer={() => null}
      />,
    )

    await user.type(screen.getByLabelText(/Best case/), '8')
    await user.type(screen.getByLabelText(/Most likely/), '5')
    await user.tab()

    expect(
      screen.getByText(/Best case \(8 days\) is higher than Most likely/),
    ).toBeInTheDocument()
  })

  it('shows a pending problem at once when Enter is pressed in a field', async () => {
    const user = userEvent.setup()
    render(
      <ThreePointEstimateForm
        unit="days"
        initial={null}
        info={info}
        footer={() => null}
      />,
    )

    await user.type(screen.getByLabelText(/Best case/), '8')
    await user.type(screen.getByLabelText(/Most likely/), '5{Enter}')

    expect(
      screen.getByText(/Best case \(8 days\) is higher than Most likely/),
    ).toBeInTheDocument()
  })

  it('has no axe violations once a typed problem has been revealed', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <ThreePointEstimateForm
        unit="days"
        initial={null}
        info={info}
        footer={() => null}
      />,
    )

    await user.type(screen.getByLabelText(/Best case/), '8')
    await user.type(screen.getByLabelText(/Most likely/), '5{Enter}')

    // color-contrast needs real layout jsdom doesn't provide; see ADR-008.
    expect(
      await axe(container, { rules: { 'color-contrast': { enabled: false } } }),
    ).toHaveNoViolations()
  })
})
