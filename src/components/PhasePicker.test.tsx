import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PhasePicker } from './PhasePicker'

describe('PhasePicker', () => {
  it('highlights the active phase label for the given index', () => {
    render(<PhasePicker index={2} onChange={vi.fn()} />)

    expect(screen.getByText('Requirements Complete')).toHaveClass(
      'phase-picker-label--active',
    )
    expect(screen.getByText('Initial Concept')).not.toHaveClass(
      'phase-picker-label--active',
    )
  })

  it('fires onChange with the clicked phase index', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<PhasePicker index={2} onChange={onChange} />)

    await user.click(screen.getByLabelText('Detailed Design Complete'))

    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('steps to the next phase via the nudge-forward arrow', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<PhasePicker index={2} onChange={onChange} />)

    await user.click(screen.getByLabelText('Next phase'))

    expect(onChange).toHaveBeenCalledWith(3)
  })

  it('steps to the previous phase via the nudge-back arrow', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<PhasePicker index={2} onChange={onChange} />)

    await user.click(screen.getByLabelText('Previous phase'))

    expect(onChange).toHaveBeenCalledWith(1)
  })

  it('marks the nudge arrows as disabled at the first and last phase', () => {
    const { rerender } = render(<PhasePicker index={0} onChange={vi.fn()} />)
    expect(screen.getByLabelText('Previous phase')).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(screen.getByLabelText('Next phase')).toHaveAttribute('aria-disabled', 'false')

    rerender(<PhasePicker index={4} onChange={vi.fn()} />)
    expect(screen.getByLabelText('Previous phase')).toHaveAttribute(
      'aria-disabled',
      'false',
    )
    expect(screen.getByLabelText('Next phase')).toHaveAttribute('aria-disabled', 'true')
  })

  it('does not call onChange from a drag that outlives the component (unmount removes the stale window listeners)', () => {
    const onChange = vi.fn()
    const { container, unmount } = render(<PhasePicker index={2} onChange={onChange} />)
    const track = container.querySelector('.phase-picker-track')
    if (!track) {
      throw new Error('expected a .phase-picker-track element')
    }

    fireEvent.pointerDown(track, { clientX: 10 })
    unmount()
    fireEvent(window, new Event('pointerup'))

    expect(onChange).not.toHaveBeenCalled()
  })
})
