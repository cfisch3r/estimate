import type { HTMLAttributes } from 'react'
import { WarningCircleIcon } from '@phosphor-icons/react/dist/csr/WarningCircle'

interface GuardNoteProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'inline' | 'banner'
  headline?: string
}

export function GuardNote({
  className,
  children,
  variant = 'inline',
  headline,
  ...props
}: GuardNoteProps) {
  const classes = ['guard-note', variant === 'banner' && 'guard-note--banner', className]
    .filter(Boolean)
    .join(' ')

  if (variant === 'banner') {
    return (
      <div className={classes} {...props}>
        <WarningCircleIcon size={24} weight="fill" />
        <div>
          <div className="guard-note-headline">{headline}</div>
          <div className="guard-note-body">{children}</div>
        </div>
      </div>
    )
  }

  return (
    <div className={classes} {...props}>
      <WarningCircleIcon size={13} weight="fill" />
      <span>{children}</span>
    </div>
  )
}
