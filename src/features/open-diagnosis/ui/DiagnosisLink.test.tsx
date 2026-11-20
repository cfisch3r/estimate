import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DiagnosisLink } from './DiagnosisLink'

describe('DiagnosisLink', () => {
  it('opens the connection diagnosis in a new tab', () => {
    render(<DiagnosisLink />)

    const link = screen.getByRole('link', {
      name: 'Show diagnosis (opens in a new tab)',
    })
    expect(link).toHaveAttribute('href', '/diagnosis')
    expect(link).toHaveAttribute('target', '_blank')
  })
})
