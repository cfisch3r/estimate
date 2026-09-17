import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useConfirmArm } from './useConfirmArm'

function TestButton({ onConfirm }: { onConfirm: () => void }) {
  const { armed, handleClick, ref } = useConfirmArm<HTMLButtonElement>(onConfirm)
  return (
    <button ref={ref} onClick={handleClick}>
      {armed ? 'armed' : 'idle'}
    </button>
  )
}

describe('useConfirmArm', () => {
  it('confirms on a second click on the control itself (#74)', () => {
    const onConfirm = vi.fn()
    render(<TestButton onConfirm={onConfirm} />)
    const button = screen.getByRole('button')

    act(() => button.click())
    expect(button.textContent).toBe('armed')

    act(() => button.click())
    expect(button.textContent).toBe('idle')
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('does not disarm on the arming click bubbling to document (#74)', () => {
    // Regression test for #74: the arming click's own event can still be
    // bubbling toward `document` when the outside-click listener attaches,
    // so a listener that disarms on ANY document click — without checking
    // the click's target — immediately undoes the arm it just set. Simulate
    // that same-event-reaches-document case directly, independent of timing.
    const onConfirm = vi.fn()
    render(<TestButton onConfirm={onConfirm} />)
    const button = screen.getByRole('button')

    act(() => button.click())
    expect(button.textContent).toBe('armed')

    act(() => {
      const event = new MouseEvent('click', { bubbles: true })
      Object.defineProperty(event, 'target', { value: button })
      document.dispatchEvent(event)
    })
    expect(button.textContent).toBe('armed')
  })

  it('disarms on a genuine click elsewhere on the page', () => {
    const onConfirm = vi.fn()
    render(
      <>
        <TestButton onConfirm={onConfirm} />
        <button>elsewhere</button>
      </>,
    )
    const button = screen.getByRole('button', { name: 'idle' })

    act(() => button.click())
    expect(button.textContent).toBe('armed')

    act(() => screen.getByRole('button', { name: 'elsewhere' }).click())
    expect(button.textContent).toBe('idle')
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
