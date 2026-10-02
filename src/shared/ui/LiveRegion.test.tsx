import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LiveRegion } from './LiveRegion'
import { VisuallyHidden } from './VisuallyHidden'

describe('LiveRegion', () => {
  it('is a polite status region by default and stays mounted while empty', () => {
    const { rerender } = render(<LiveRegion />)
    const region = screen.getByRole('status')
    expect(region).toBeEmptyDOMElement()

    rerender(<LiveRegion>Sending your estimate…</LiveRegion>)

    expect(screen.getByRole('status')).toBe(region)
    expect(region).toHaveTextContent('Sending your estimate…')
  })

  it('can be an alert region', () => {
    render(<LiveRegion role="alert">Not delivered</LiveRegion>)

    expect(screen.getByRole('alert')).toHaveTextContent('Not delivered')
  })
})

describe('VisuallyHidden', () => {
  it('keeps its text in the accessibility tree', () => {
    render(<VisuallyHidden>Estimates revealed.</VisuallyHidden>)

    expect(screen.getByText('Estimates revealed.')).toBeInTheDocument()
  })
})
