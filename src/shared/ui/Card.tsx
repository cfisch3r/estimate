import type { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevation?: 'sm' | 'md' | 'lg'
}

export function Card({ elevation, className, ...props }: CardProps) {
  const classes = ['card', elevation && `elev-${elevation}`, className]
    .filter(Boolean)
    .join(' ')
  return <div className={classes} {...props} />
}

export function CardKicker(props: HTMLAttributes<HTMLDivElement>) {
  return <div className="card-kicker" {...props} />
}

interface CardTitleProps extends HTMLAttributes<HTMLElement> {
  /** The heading level this title renders as, or `'span'` for a styled
   *  non-heading label (e.g. a list of action rows where a heading would
   *  skip levels from the page's own h1). Defaults to `'h3'`, the level
   *  every other call site uses. */
  as?: 'h1' | 'h2' | 'h3' | 'span'
}

// A generic pass-through wrapper: oxlint can't see the `children` prop
// forwarded via `{...props}` at this definition site, but every call site
// passes visible text content — the real check belongs at the call site.
export function CardTitle({ as: Tag = 'h3', className, ...props }: CardTitleProps) {
  // oxlint-disable-next-line jsx-a11y/heading-has-content
  return (
    <Tag className={['card-title', className].filter(Boolean).join(' ')} {...props} />
  )
}

export function CardBody(props: HTMLAttributes<HTMLParagraphElement>) {
  return <p className="card-body" {...props} />
}

export function CardMeta(props: HTMLAttributes<HTMLDivElement>) {
  return <div className="card-meta" {...props} />
}
