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

  it('never places the 90%-confidence marker left of the expected marker, even when expected itself is past 80%', () => {
    render(<RangeBar min={0} max={10} expected={9} ci90={9.5} unitSuffix="w" />)

    expect(screen.getByTestId('range-bar-marker-expected')).toHaveStyle({ left: '90%' })
    expect(screen.getByTestId('range-bar-marker-ci90')).toHaveStyle({ left: '90%' })
  })

  it('renders the best and worst case values and captions', () => {
    render(<RangeBar min={2} max={6} expected={4} ci90={5.7} unitSuffix="w" />)

    expect(screen.getByText('2w')).toBeInTheDocument()
    expect(screen.getByText('best case')).toBeInTheDocument()
    expect(screen.getByText('6w')).toBeInTheDocument()
    expect(screen.getByText('worst case')).toBeInTheDocument()
  })

  it('hides the 90%-confidence marker and callout, and shows a warning, when it reaches or exceeds worst case', () => {
    // McConnell's formula is an additive offset from "most likely," so for a narrow
    // enough range it can mathematically reach worst case: 6 + 1.28*(6.5-5)/3 ≈ 6.64
    render(<RangeBar min={5} max={6.5} expected={6} ci90={6.64} unitSuffix="d" />)

    expect(screen.queryByTestId('range-bar-marker-ci90')).not.toBeInTheDocument()
    expect(screen.queryByText('90% confidence')).not.toBeInTheDocument()
    expect(
      screen.getByText(
        '90% confidence reaches or exceeds worst case — this range may be too narrow.',
      ),
    ).toBeInTheDocument()
  })

  it('still shows the 90%-confidence marker when it is below worst case', () => {
    render(<RangeBar min={5} max={10} expected={6} ci90={8} unitSuffix="d" />)

    expect(screen.getByTestId('range-bar-marker-ci90')).toBeInTheDocument()
    expect(
      screen.queryByText(
        '90% confidence reaches or exceeds worst case — this range may be too narrow.',
      ),
    ).not.toBeInTheDocument()
  })
})

describe('RangeBar with guidance', () => {
  it('renders compressed (worst marker pinned at 78%) when worst case is narrower than the guidance ceiling', () => {
    // Requirements Complete: guidanceHigh = 5.4 * (1.5/0.67) ≈ 12.09; worst=6.9 is well under it
    render(
      <RangeBar
        min={5.4}
        max={6.9}
        expected={6}
        ci90={6.5}
        unitSuffix="d"
        guidance={{ level: 'requirements-complete' }}
      />,
    )

    expect(screen.getByTestId('range-bar-marker-worst')).toHaveStyle({ left: '78%' })
    expect(screen.getByText('guidance ceiling')).toBeInTheDocument()
  })

  it('in the compressed state, hides the 90%-confidence marker and warns when it reaches or exceeds worst case', () => {
    // 6 + 1.28*(6.5-5)/3 ≈ 6.64 > worst (6.5); guidanceHigh = 5*(1.5/0.67) ≈ 11.19, so
    // worst (6.5) still stays below it and the compressed branch renders.
    render(
      <RangeBar
        min={5}
        max={6.5}
        expected={6}
        ci90={6.64}
        unitSuffix="d"
        guidance={{ level: 'requirements-complete' }}
      />,
    )

    expect(screen.queryByTestId('range-bar-marker-ci90')).not.toBeInTheDocument()
    expect(
      screen.getByText(
        '90% confidence reaches or exceeds worst case — this range may be too narrow.',
      ),
    ).toBeInTheDocument()
  })

  it('renders full-width (worst marker at 100%) when worst case already meets/exceeds the guidance ceiling', () => {
    // Requirements Complete: guidanceHigh = 5 * (1.5/0.67) ≈ 11.19; worst=13 exceeds it
    render(
      <RangeBar
        min={5}
        max={13}
        expected={7}
        ci90={10.2}
        unitSuffix="d"
        guidance={{ level: 'requirements-complete' }}
      />,
    )

    expect(screen.getByTestId('range-bar-marker-worst')).toHaveStyle({ left: '100%' })
    expect(screen.getByText(/ceiling/)).toBeInTheDocument()
    expect(screen.queryByText('guidance ceiling')).not.toBeInTheDocument()
  })

  it('in the full-width state, hides the 90%-confidence marker and warns when it reaches or exceeds worst case', () => {
    // guidanceHigh = 8*(1.1/0.9) ≈ 9.78 < worst (10), so the full-width branch renders;
    // 9.5 + 1.28*(10-8)/3 ≈ 10.35 > worst (10).
    render(
      <RangeBar
        min={8}
        max={10}
        expected={9.5}
        ci90={10.35}
        unitSuffix="d"
        guidance={{ level: 'detailed-design-complete' }}
      />,
    )

    expect(screen.queryByTestId('range-bar-marker-ci90')).not.toBeInTheDocument()
    expect(
      screen.getByText(
        '90% confidence reaches or exceeds worst case — this range may be too narrow.',
      ),
    ).toBeInTheDocument()
  })

  it('positions the ceiling tick at the guidance ceiling value within the full-width track', () => {
    // min=5, highMult/lowMult = 1.5/0.67 -> guidanceHigh ≈ 11.194; span 5..13 -> pct ≈ 77.4%
    render(
      <RangeBar
        min={5}
        max={13}
        expected={7}
        ci90={10.2}
        unitSuffix="d"
        guidance={{ level: 'requirements-complete' }}
      />,
    )

    const guidanceHigh = 5 * (1.5 / 0.67)
    const expectedPct = ((guidanceHigh - 5) / (13 - 5)) * 100
    const tick = screen.getByText(/ceiling/).closest('div')
    expect(tick).toHaveStyle({ left: `${expectedPct}%` })
  })

  it('pushes the expected and 90%-confidence markers apart when they would otherwise collide', () => {
    // expected and ci90 both land within a couple percent of each other pre-adjustment
    render(
      <RangeBar
        min={0}
        max={100}
        expected={50}
        ci90={51}
        unitSuffix="d"
        guidance={{ level: 'requirements-complete' }}
      />,
    )

    const expectedLeft = parseFloat(
      (screen.getByTestId('range-bar-marker-expected').style.left ?? '0').replace(
        '%',
        '',
      ),
    )
    const ci90Left = parseFloat(
      (screen.getByTestId('range-bar-marker-ci90').style.left ?? '0').replace('%', ''),
    )
    expect(ci90Left - expectedLeft).toBeCloseTo((90 / 560) * 100, 5)
  })

  it('clamps the below-track "most likely" label to stay at least 14% from either edge', () => {
    // expected sits at 2% of the span -> label would collide with the best-case label
    render(
      <RangeBar
        min={0}
        max={100}
        expected={2}
        ci90={90}
        unitSuffix="d"
        guidance={{ level: 'requirements-complete' }}
      />,
    )

    const label = screen.getByText('2d').closest('div')
    expect(label).toHaveStyle({ left: '14%' })
  })
})
