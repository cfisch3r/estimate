import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EstimateInput } from './EstimateInput'

function renderInput(props: Partial<Parameters<typeof EstimateInput>[0]> = {}) {
  return render(
    <>
      <p id="issue">Best case is higher than Most likely.</p>
      <EstimateInput
        field="best"
        label="Best case"
        unit="days"
        value=""
        onChange={vi.fn()}
        invalid={false}
        issueId="issue"
        {...props}
      />
    </>,
  )
}

describe('EstimateInput', () => {
  it('labels the input with its unit and uses the field as its id', () => {
    renderInput()

    const input = screen.getByLabelText('Best case (days)')
    expect(input).toHaveAttribute('id', 'best')
    expect(input).not.toHaveAttribute('aria-invalid')
    expect(input).not.toHaveAccessibleDescription()
  })

  it('reports typed text through onChange', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderInput({ onChange })

    await user.type(screen.getByLabelText('Best case (days)'), '3')

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('3')
  })

  it('is described by the issue message when it is invalid', () => {
    renderInput({ value: '8', invalid: true })

    const input = screen.getByLabelText('Best case (days)')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Best case is higher than Most likely.')
  })

  it('is described by both its rounding note and the issue message', () => {
    renderInput({ value: '1.3', invalid: true })

    expect(screen.getByLabelText('Best case (days)')).toHaveAccessibleDescription(
      'Consider rounding to a meaningful value. Best case is higher than Most likely.',
    )
  })

  it('commits on blur and on Enter', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn()
    renderInput({ onCommit })
    const input = screen.getByLabelText('Best case (days)')

    await user.type(input, '4{Enter}')
    expect(onCommit).toHaveBeenCalledTimes(1)

    await user.tab()
    expect(onCommit).toHaveBeenCalledTimes(2)
  })
})
