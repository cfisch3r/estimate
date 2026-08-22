import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from './Field'

describe('Input', () => {
  it('blocks non-numeric keys like "e" on a type="number" input', async () => {
    const user = userEvent.setup()
    render(<Input type="number" aria-label="value" />)

    const input = screen.getByLabelText('value')
    await user.type(input, '1e2')

    expect(input).toHaveValue(12)
  })

  it('still allows digits and decimal points on a type="number" input', async () => {
    const user = userEvent.setup()
    render(<Input type="number" aria-label="value" />)

    const input = screen.getByLabelText('value')
    await user.type(input, '12.5')

    expect(input).toHaveValue(12.5)
  })

  it('does not block "e" on non-number inputs', async () => {
    const user = userEvent.setup()
    render(<Input type="text" aria-label="text-value" />)

    const input = screen.getByLabelText('text-value')
    await user.type(input, 'hello')

    expect(input).toHaveValue('hello')
  })
})
