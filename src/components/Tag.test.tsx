import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Tag } from './Tag'

describe('Tag', () => {
  it('renders its children', () => {
    render(<Tag>Backend</Tag>)

    expect(screen.getByText('Backend')).toBeInTheDocument()
  })

  it('defaults to the neutral variant', () => {
    render(<Tag>Backend</Tag>)

    expect(screen.getByText('Backend')).toHaveClass('tag', 'tag-neutral')
  })

  it('applies the requested variant', () => {
    render(<Tag variant="accent">Backend</Tag>)

    expect(screen.getByText('Backend')).toHaveClass('tag-accent')
  })

  it('merges a custom className with the base classes', () => {
    render(<Tag className="extra">Backend</Tag>)

    expect(screen.getByText('Backend')).toHaveClass('tag', 'tag-neutral', 'extra')
  })
})
