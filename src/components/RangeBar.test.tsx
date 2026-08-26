import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RangeBar } from './RangeBar'

describe('RangeBar', () => {
  it('positions the expected and 90%-confidence markers at their percentage of the best-worst span', () => {
    render(<RangeBar min={0} max={10} expected={5} ci90={8} unitSuffix="w" />)

    expect(screen.getByTestId('range-bar-marker-expected')).toHaveStyle({ left: '50%' })
    expect(screen.getByTestId('range-bar-marker-ci90')).toHaveStyle({ left: '80%' })
  })

  it('clamps the 90%-confidence marker to 80% of the span so it never collides with the worst-case label', () => {
    render(<RangeBar min={0} max={10} expected={5} ci90={9.5} unitSuffix="w" />)

    expect(screen.getByTestId('range-bar-marker-ci90')).toHaveStyle({ left: '80%' })
  })

  it('renders the best and worst case values and captions', () => {
    render(<RangeBar min={2} max={6} expected={4} ci90={5.7} unitSuffix="w" />)

    expect(screen.getByText('2w')).toBeInTheDocument()
    expect(screen.getByText('best case')).toBeInTheDocument()
    expect(screen.getByText('6w')).toBeInTheDocument()
    expect(screen.getByText('worst case')).toBeInTheDocument()
  })
})
