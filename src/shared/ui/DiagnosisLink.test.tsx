import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { DiagnosisLink } from './DiagnosisLink'

describe('DiagnosisLink', () => {
  it('opens the connection diagnosis in a new tab, and says so', () => {
    render(<DiagnosisLink />)

    const link = screen.getByRole('link', {
      name: 'Show diagnosis (opens in a new tab)',
    })
    expect(link).toHaveAttribute('href', '/diagnosis')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = render(<DiagnosisLink />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
