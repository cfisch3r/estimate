import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { EstimateTriple } from './EstimateTriple'

describe('EstimateTriple', () => {
  it('renders best / likely / worst with the unit suffix', () => {
    const { container } = render(
      <EstimateTriple best={2} likely={4} worst={8} unit="days" />,
    )

    expect(container.textContent).toBe('2d / 4d / 8d')
    expect(container.querySelector('strong')).toBeNull()
  })

  it('bolds only the numbers when emphasis is set', () => {
    const { container } = render(
      <EstimateTriple best={2} likely={4} worst={8} unit="days" emphasis />,
    )

    expect(container.textContent).toBe('2d / 4d / 8d')
    expect([...container.querySelectorAll('strong')].map((el) => el.textContent)).toEqual(
      ['2', '4', '8'],
    )
  })
})
