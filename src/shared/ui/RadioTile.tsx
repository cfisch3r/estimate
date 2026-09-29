import type { InputHTMLAttributes, ReactNode } from 'react'

interface RadioTileProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode
  description?: ReactNode
}

export function RadioTile({ label, description, className, ...props }: RadioTileProps) {
  return (
    <label className={['radio-tile', className].filter(Boolean).join(' ')}>
      <input type="radio" {...props} />
      <span className="dot" />
      <span>
        <div className="card-title">{label}</div>
        {description && <div className="card-meta">{description}</div>}
      </span>
    </label>
  )
}
