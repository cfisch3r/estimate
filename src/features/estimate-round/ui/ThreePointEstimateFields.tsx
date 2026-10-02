import { useEffect, useRef } from 'react'
import { GroupBox } from '../../../shared/ui/GroupBox'
import { THREE_POINT_ESTIMATE_INFO } from '../../../shared/copy'
import type { EstimateField, EstimationUnit } from '../../../entities/estimate'
import type { EstimateIssue } from '../lib/describeEstimateIssue'
import { EstimateInput } from './EstimateInput'

const FIELDS: { field: EstimateField; label: string }[] = [
  { field: 'best', label: 'Best case' },
  { field: 'likely', label: 'Most likely' },
  { field: 'worst', label: 'Worst case' },
]

interface ThreePointEstimateFieldsProps {
  unit: EstimationUnit
  best: string
  likely: string
  worst: string
  onBestChange: (value: string) => void
  onLikelyChange: (value: string) => void
  onWorstChange: (value: string) => void
  /** What is wrong with the entry, or null. The inputs it names are marked invalid. */
  issue: EstimateIssue | null
  /** The id of the element that shows `issue`'s message; marked inputs point at it. */
  issueId: string
  /** Focus the first input when the fields mount (e.g. when opening a revise form). */
  focusOnMount?: boolean
  /** A value was committed — an input lost focus, or Enter was pressed in it — so
   *  the caller can show a pending problem now. */
  onFieldCommit?: () => void
  infoOpen: boolean
  onInfoOpen: () => void
  onInfoClose: () => void
}

/** The Best / Most likely / Worst input trio, shared by Workspace's
 *  ActiveItemPanel and ParticipantEstimateView's EstimateForm. Each input
 *  (`EstimateInput`) owns its false-precision note; validation (createEstimate)
 *  stays with each caller since it also drives UI outside this block. */
export function ThreePointEstimateFields({
  unit,
  best,
  likely,
  worst,
  onBestChange,
  onLikelyChange,
  onWorstChange,
  issue,
  issueId,
  focusOnMount = false,
  onFieldCommit,
  infoOpen,
  onInfoOpen,
  onInfoClose,
}: ThreePointEstimateFieldsProps) {
  const fieldsRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (focusOnMount) fieldsRef.current?.querySelector('input')?.focus()
  }, [focusOnMount])

  const values: Record<EstimateField, string> = { best, likely, worst }
  const onChange: Record<EstimateField, (value: string) => void> = {
    best: onBestChange,
    likely: onLikelyChange,
    worst: onWorstChange,
  }

  return (
    <GroupBox
      label="Three-point estimate"
      info={THREE_POINT_ESTIMATE_INFO}
      infoOpen={infoOpen}
      onInfoOpen={onInfoOpen}
      onInfoClose={onInfoClose}
    >
      <div ref={fieldsRef} style={{ display: 'flex', gap: 'var(--space-4)' }}>
        {FIELDS.map(({ field, label }) => (
          <EstimateInput
            key={field}
            field={field}
            label={label}
            unit={unit}
            value={values[field]}
            onChange={onChange[field]}
            invalid={issue?.fields.includes(field) ?? false}
            issueId={issueId}
            onCommit={onFieldCommit}
          />
        ))}
      </div>
    </GroupBox>
  )
}
