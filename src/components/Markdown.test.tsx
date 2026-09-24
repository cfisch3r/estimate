import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Markdown } from './Markdown'

describe('Markdown', () => {
  it('renders markdown syntax as formatted HTML', () => {
    render(<Markdown content={'**bold** and _italic_\n\n- one\n- two'} />)

    expect(screen.getByText('bold').tagName).toBe('STRONG')
    expect(screen.getByText('italic').tagName).toBe('EM')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('renders a markdown link with its href', () => {
    render(<Markdown content="[docs](https://example.com)" />)

    expect(screen.getByRole('link', { name: 'docs' })).toHaveAttribute(
      'href',
      'https://example.com',
    )
  })

  it('strips script tags and inline event handlers', () => {
    const { container } = render(
      <Markdown content={'<script>window.pwned = true</script><img src=x onerror=alert(1)>'} />,
    )

    expect(container.querySelector('script')).not.toBeInTheDocument()
    expect(container.querySelector('img')?.getAttribute('onerror')).toBeNull()
  })

  it('merges a custom className onto the scroll box, keeping the wrap and content div plain', () => {
    const { container } = render(<Markdown content="hi" className="card-body" />)

    expect(container.firstChild).toHaveClass('markdown-wrap')
    expect(container.firstChild).not.toHaveClass('card-body')
    expect(container.querySelector('.markdown-box')).toHaveClass('card-body')
    expect(container.querySelector('.markdown')).not.toHaveClass('card-body')
  })
})
