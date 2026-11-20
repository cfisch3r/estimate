import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { aggregateOf } from '../../../domain/testFixtures'
import { AggregatedRange } from './AggregatedRange'

const noop = vi.fn()

describe('AggregatedRange', () => {
  it("labels a revealed round's range as aggregated", () => {
    render(
      <AggregatedRange
        kind="aggregated"
        range={aggregateOf(2, 4, 10)}
        unit="days"
        infoOpen={false}
        onInfoOpen={noop}
        onInfoClose={noop}
      />,
    )
    expect(screen.getByText('Range (aggregated)')).toBeInTheDocument()
  })

  it('shows the labelled range in the unit', () => {
    render(
      <AggregatedRange
        kind="finalized"
        range={aggregateOf(2, 4, 10)}
        unit="days"
        infoOpen={false}
        onInfoOpen={noop}
        onInfoClose={noop}
      />,
    )

    expect(screen.getByText('Range (finalized)')).toBeInTheDocument()
    expect(screen.getByText('2d')).toBeInTheDocument()
    expect(screen.getByText('10d')).toBeInTheDocument()
  })
})
