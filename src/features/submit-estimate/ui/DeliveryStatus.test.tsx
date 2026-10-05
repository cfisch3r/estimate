import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DeliveryStatus } from './DeliveryStatus'

describe('DeliveryStatus', () => {
  it('shows a sending notice while the send is in flight', () => {
    render(<DeliveryStatus state="sending" />)

    expect(screen.getByText('Sending your estimate…')).toBeInTheDocument()
  })

  it('shows the retry banner when the send failed', () => {
    render(<DeliveryStatus state="not-delivered" />)

    expect(screen.getByText('Not delivered yet')).toBeInTheDocument()
  })

  it('shows nothing once the estimate is submitted', () => {
    render(<DeliveryStatus state="submitted" />)

    expect(screen.queryByText('Sending your estimate…')).not.toBeInTheDocument()
    expect(screen.queryByText('Not delivered yet')).not.toBeInTheDocument()
  })

  it.each(['sending', 'not-delivered'] as const)(
    'shows nothing for %s while suppressed',
    (state) => {
      render(<DeliveryStatus state={state} suppressed />)

      expect(screen.queryByText('Sending your estimate…')).not.toBeInTheDocument()
      expect(screen.queryByText('Not delivered yet')).not.toBeInTheDocument()
    },
  )
})
