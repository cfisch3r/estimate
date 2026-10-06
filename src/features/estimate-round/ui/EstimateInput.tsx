import { useId, type KeyboardEvent } from 'react'
import { Field, FieldLabel, Input } from '../../../shared/ui/Field'
import { GuardNote } from '../../../shared/ui/GuardNote'
import { checkFalsePrecision, UNIT_GRANULARITY } from '../../../entities/session'
import type { EstimateField, EstimationUnit } from '../../../entities/session'

const inputStyle = {
  height: 48,
  fontSize: '1.1rem',
  textAlign: 'center' as const,
  borderRadius: 'var(--radius-lg)',
}

interface EstimateInputProps {
  field: EstimateField
  /** The visible label, without the unit. */
  label: string
  unit: EstimationUnit
  value: string
  onChange: (value: string) => void
  /** The entry's current problem names this input: mark it invalid. */
  invalid: boolean
  /** The id of the element that shows the entry's problem; an invalid input points at it. */
  issueId: string
  /** A value was committed — the input lost focus, or Enter was pressed in it. */
  onCommit?: () => void
}

/** One labelled number input of the three-point estimate, with its own
 *  false-precision note. The input is described by that note and, when it is
 *  invalid, by the entry's issue message too. The `field` doubles as the input id. */
export function EstimateInput({
  field,
  label,
  unit,
  value,
  onChange,
  invalid,
  issueId,
  onCommit,
}: EstimateInputProps) {
  const noteId = useId()
  const precision =
    value !== '' ? checkFalsePrecision(Number(value), UNIT_GRANULARITY[unit]) : null
  const roundingNote = precision?.fired ?? false
  const describedBy = [roundingNote ? noteId : null, invalid ? issueId : null]
    .filter(Boolean)
    .join(' ')

  return (
    <Field style={{ flex: 1 }}>
      <FieldLabel htmlFor={field}>{`${label} (${unit})`}</FieldLabel>
      <Input
        id={field}
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
          if (event.key === 'Enter') onCommit?.()
        }}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy || undefined}
        style={inputStyle}
      />
      {roundingNote && (
        <GuardNote id={noteId}>Consider rounding to a meaningful value.</GuardNote>
      )}
    </Field>
  )
}
