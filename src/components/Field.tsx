import type {
  HTMLAttributes,
  InputHTMLAttributes,
  KeyboardEvent,
  LabelHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'

export function Field({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={['field', className].filter(Boolean).join(' ')} {...props} />
}

export function FieldLabel(props: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label {...props} />
}

// Native <input type="number"> accepts 'e'/'E' (scientific notation) and '+'/'-',
// which read as valid numbers but aren't meaningful estimate values.
const BLOCKED_NUMBER_KEYS = new Set(['e', 'E', '+', '-'])

export function Input({ className, onKeyDown, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (props.type === 'number' && BLOCKED_NUMBER_KEYS.has(event.key)) {
      event.preventDefault()
    }
    onKeyDown?.(event)
  }

  return (
    <input
      className={['input', className].filter(Boolean).join(' ')}
      onKeyDown={handleKeyDown}
      {...props}
    />
  )
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={['input', className].filter(Boolean).join(' ')} {...props} />
  )
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={['input', className].filter(Boolean).join(' ')} {...props} />
}
