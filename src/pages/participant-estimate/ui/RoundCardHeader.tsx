import { CardKicker, CardTitle, Markdown } from '../../../shared/ui'

interface RoundCardHeaderProps {
  kicker: string
  item: { title: string; description: string }
}

/** The session kicker, item title and description shared by every in-round card.
 *  CardTitle is an h1, not its default h3: every state this screen can be in
 *  renders exactly one of these as its only heading — mirroring the facilitator
 *  Workspace's item-title EditableTitle, also an h1 — and axe's
 *  page-has-heading-one rule caught the page having none at all. */
export function RoundCardHeader({ kicker, item }: RoundCardHeaderProps) {
  return (
    <>
      <CardKicker>{kicker}</CardKicker>
      <CardTitle as="h1">{item.title}</CardTitle>
      {item.description && (
        <Markdown content={item.description} className="card-body markdown-preview" />
      )}
    </>
  )
}
