import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  icon?: boolean
  block?: boolean
}

export function Button({
  variant = 'secondary',
  icon,
  block,
  className,
  ...props
}: ButtonProps) {
  const classes = [
    'btn',
    `btn-${variant}`,
    icon && 'btn-icon',
    block && 'btn-block',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return <button className={classes} {...props} />
}
