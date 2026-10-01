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

// A generic pass-through wrapper: oxlint can't see the `children` prop
// forwarded via `{...props}` at this definition site, but every call site
// passes visible text content — the real check belongs at the call site.
export function CardTitle(props: HTMLAttributes<HTMLHeadingElement>) {
  // oxlint-disable-next-line jsx-a11y/heading-has-content
  return <h3 className="card-title" {...props} />
}

export function CardBody(props: HTMLAttributes<HTMLParagraphElement>) {
  return <p className="card-body" {...props} />
}

export function CardMeta(props: HTMLAttributes<HTMLDivElement>) {
  return <div className="card-meta" {...props} />
}
