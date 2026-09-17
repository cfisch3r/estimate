import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  icon?: boolean
  block?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', icon, block, className, ...props },
  ref,
) {
  const classes = [
    'btn',
    `btn-${variant}`,
    icon && 'btn-icon',
    block && 'btn-block',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return <button ref={ref} className={classes} {...props} />
})
