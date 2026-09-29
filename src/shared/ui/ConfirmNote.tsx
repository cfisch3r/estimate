import type { HTMLAttributes } from 'react'
import { CheckCircleIcon } from '@phosphor-icons/react/dist/csr/CheckCircle'

interface ConfirmNoteProps extends HTMLAttributes<HTMLDivElement> {}

/** A calm, positive counterpart to GuardNote — used where a guard's soft nudge
 *  would otherwise fire but the underlying condition is actually already satisfied
 *  (e.g. the entered range already covers the cone-of-uncertainty guidance ceiling,
 *  PRD §6.1). Success, not warning, so it gets its own icon/semantics rather than
 *  reusing GuardNote. */
export function ConfirmNote({ className, children, ...props }: ConfirmNoteProps) {
  const classes = ['confirm-note', className].filter(Boolean).join(' ')

  return (
    <div className={classes} {...props}>
      <CheckCircleIcon size={16} weight="fill" />
      <span>{children}</span>
    </div>
  )
}
