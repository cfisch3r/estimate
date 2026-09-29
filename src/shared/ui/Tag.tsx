import type { HTMLAttributes } from 'react'

interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'accent' | 'accent-2' | 'neutral' | 'outline'
}

export function Tag({ variant = 'neutral', className, ...props }: TagProps) {
  const classes = ['tag', `tag-${variant}`, className].filter(Boolean).join(' ')
  return <span className={classes} {...props} />
}
