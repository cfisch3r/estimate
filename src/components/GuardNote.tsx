import type { HTMLAttributes } from 'react'
import { WarningCircleIcon } from '@phosphor-icons/react/dist/csr/WarningCircle'

export function GuardNote({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={['guard-note', className].filter(Boolean).join(' ')} {...props}>
      <WarningCircleIcon size={13} weight="fill" />
      <span>{children}</span>
    </div>
  )
}
