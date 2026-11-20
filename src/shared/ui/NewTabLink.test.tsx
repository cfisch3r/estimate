import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { NewTabLink } from './NewTabLink'

describe('NewTabLink', () => {
  it('opens its address in a new tab, and tells screen readers so', () => {
    render(<NewTabLink href="/somewhere">Go there</NewTabLink>)

    const link = screen.getByRole('link', { name: 'Go there (opens in a new tab)' })
    expect(link).toHaveAttribute('href', '/somewhere')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('shows sighted users a new-tab icon, hidden from screen readers', () => {
    render(<NewTabLink href="/somewhere">Go there</NewTabLink>)

    const icon = screen.getByRole('link').querySelector('svg')
    expect(icon).not.toBeNull()
    expect(icon).toHaveAttribute('aria-hidden', 'true')
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = render(<NewTabLink href="/somewhere">Go there</NewTabLink>)
    expect(await axe(container)).toHaveNoViolations()
  })
})
