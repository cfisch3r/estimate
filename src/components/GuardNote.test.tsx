import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GuardNote } from './GuardNote'

describe('GuardNote', () => {
  it('renders children inline with no headline by default', () => {
    render(<GuardNote>Consider rounding to a meaningful value.</GuardNote>)

    expect(screen.getByText('Consider rounding to a meaningful value.')).toBeInTheDocument()
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('renders a headline and body as a banner when variant is banner', () => {
    render(
      <GuardNote variant="banner" headline="Symmetric range">
        Worst case in software usually has more room than best case. Double check.
      </GuardNote>,
    )

    expect(screen.getByText('Symmetric range')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Worst case in software usually has more room than best case. Double check.',
      ),
    ).toBeInTheDocument()
  })
})
