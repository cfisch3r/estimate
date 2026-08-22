import type {
  ChangeEvent,
  ClipboardEvent,
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
// which read as valid numbers but aren't meaningful estimate values. Keydown blocks
// typed keystrokes; the onChange strip below also catches paste/drag/autofill, which
// never fire keydown.
const BLOCKED_NUMBER_KEYS = new Set(['e', 'E', '+', '-'])
const BLOCKED_NUMBER_CHARS = /[eE+-]/g

// Triggers React's own change-detection machinery, the same trick React DevTools
// and testing-library use to make a programmatic value change look native.
const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
  window.HTMLInputElement.prototype,
  'value',
)?.set

export function Input({
  className,
  onKeyDown,
  onChange,
  onPaste,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (props.type === 'number' && BLOCKED_NUMBER_KEYS.has(event.key)) {
      event.preventDefault()
    }
    onKeyDown?.(event)
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    if (props.type === 'number') {
      const sanitized = event.target.value.replace(BLOCKED_NUMBER_CHARS, '')
      if (sanitized !== event.target.value) {
        event.target.value = sanitized
      }
    }
    onChange?.(event)
  }

  // Pasted/dropped text never fires keydown, and a type="number" input normalizes
  // the raw pasted string (e.g. "1e5" -> "100000") before any change event exposes
  // it — so blocked characters must be stripped from the clipboard text itself.
  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    if (props.type === 'number') {
      const pasted = event.clipboardData.getData('text')
      const sanitized = pasted.replace(BLOCKED_NUMBER_CHARS, '')
      if (sanitized !== pasted) {
        event.preventDefault()
        const input = event.currentTarget
        const start = input.selectionStart ?? input.value.length
        const end = input.selectionEnd ?? input.value.length
        const nextValue = input.value.slice(0, start) + sanitized + input.value.slice(end)
        nativeInputValueSetter?.call(input, nextValue)
        input.dispatchEvent(new Event('input', { bubbles: true }))
      }
    }
    onPaste?.(event)
  }

  return (
    <input
      className={['input', className].filter(Boolean).join(' ')}
      onKeyDown={handleKeyDown}
      onChange={handleChange}
      onPaste={handlePaste}
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
