import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RadioTile } from './RadioTile'

describe('RadioTile', () => {
  it('renders the label and optional description', () => {
    render(<RadioTile name="unit" label="Days" description="Whole workdays" />)

    expect(screen.getByText('Days')).toBeInTheDocument()
    expect(screen.getByText('Whole workdays')).toBeInTheDocument()
  })

  it('omits the description block when none is given', () => {
    render(<RadioTile name="unit" label="Days" />)

    expect(screen.queryByText('Whole workdays')).not.toBeInTheDocument()
  })

  it('renders as a radio input reflecting checked state', () => {
    render(<RadioTile name="unit" label="Days" checked readOnly />)

    expect(screen.getByRole('radio')).toBeChecked()
  })

  it('fires onChange when selected', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<RadioTile name="unit" label="Days" onChange={onChange} />)

    await user.click(screen.getByRole('radio'))

    expect(onChange).toHaveBeenCalled()
  })

  it('merges a custom className with the base class', () => {
    render(<RadioTile name="unit" label="Days" className="extra" />)

    expect(screen.getByText('Days').closest('label')).toHaveClass('radio-tile', 'extra')
  })
})
