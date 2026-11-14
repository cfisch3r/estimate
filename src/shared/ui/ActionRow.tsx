import type { ReactNode, Ref } from 'react'
import { ArrowRightIcon } from '@phosphor-icons/react/dist/csr/ArrowRight'
import { Card, CardTitle, CardBody } from './Card'

interface ActionRowProps {
  icon: ReactNode
  title: string
  description: string
  onClick: () => void
  ref?: Ref<HTMLDivElement>
}

/** A full-width card row that starts an action: icon, title, one-line
 *  description and an arrow. Used for the entry choices on mode selection. */
export function ActionRow({ icon, title, description, onClick, ref }: ActionRowProps) {
  return (
    <Card
      ref={ref}
      elevation="sm"
      // A native <button> can't validly contain this row's heading/paragraph
      // content (button's content model is phrasing content only, and
      // CardTitle/CardBody render <h3>/<p>, which are flow content) — role +
      // manual key handling is the spec-conformant pattern for this case.
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 'var(--space-4)',
        padding: 'var(--space-4)',
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          fontSize: 22,
          color: 'var(--color-accent-300)',
          flex: 'none',
          display: 'flex',
        }}
      >
        {icon}
      </span>
      <span style={{ flex: 1 }}>
        {/* Not a document heading — these rows are a list of entry
         *  actions, not subsections of the page, and an h3 here would jump
         *  straight from the page's own h1 with nothing in between. */}
        <CardTitle as="span" style={{ display: 'block' }}>
          {title}
        </CardTitle>
        <CardBody style={{ display: 'block' }}>{description}</CardBody>
      </span>
      <ArrowRightIcon
        size={16}
        style={{ color: 'var(--color-accent-300)', flex: 'none' }}
      />
    </Card>
  )
}
