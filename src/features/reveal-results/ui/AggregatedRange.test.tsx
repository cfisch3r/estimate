import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createEstimate } from '../../../entities/estimate'
import { AggregatedRange } from './AggregatedRange'

function estimate(participantId: string, best: number, likely: number, worst: number) {
  const result = createEstimate({ participantId, best, likely, worst })
  if (!result.ok) throw new Error(result.error)
  return result.value
}

const noop = vi.fn()

describe('AggregatedRange', () => {
  it('renders nothing when no estimates were submitted', () => {
    const { container } = render(
      <AggregatedRange
        submissions={[]}
        unit="days"
        infoOpen={false}
        onInfoOpen={noop}
        onInfoClose={noop}
      />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('shows the labelled aggregate of the submissions in the unit', () => {
    render(
      <AggregatedRange
        submissions={[estimate('a', 2, 4, 8), estimate('b', 3, 5, 10)]}
        unit="days"
        infoOpen={false}
        onInfoOpen={noop}
        onInfoClose={noop}
      />,
    )

    expect(screen.getByText('Range (aggregated)')).toBeInTheDocument()
    // min of the best cases and max of the worst cases, suffixed with the unit.
    expect(screen.getByText('2d')).toBeInTheDocument()
    expect(screen.getByText('10d')).toBeInTheDocument()
  })
})
