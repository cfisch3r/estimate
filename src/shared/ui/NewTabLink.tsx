import type { ReactNode } from 'react'
import { ArrowSquareOutIcon } from '@phosphor-icons/react/dist/csr/ArrowSquareOut'
import { VisuallyHidden } from './VisuallyHidden'

interface NewTabLinkProps {
  href: string
  children: ReactNode
}

/** A link that opens in a new tab and says so: an icon for sighted users, a
 *  hidden "(opens in a new tab)" for screen readers. */
export function NewTabLink({ href, children }: NewTabLinkProps) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}{' '}
      <ArrowSquareOutIcon
        size={12}
        aria-hidden="true"
        style={{ verticalAlign: 'baseline' }}
      />{' '}
      <VisuallyHidden>(opens in a new tab)</VisuallyHidden>
    </a>
  )
}
