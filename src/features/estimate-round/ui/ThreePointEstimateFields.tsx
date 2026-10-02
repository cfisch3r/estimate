import { Field, FieldLabel, Input } from '../../../shared/ui/Field'
import { GuardNote } from '../../../shared/ui/GuardNote'
import { GroupBox } from '../../../shared/ui/GroupBox'
import { THREE_POINT_ESTIMATE_INFO } from '../../../shared/copy'
import { checkFalsePrecision, UNIT_GRANULARITY } from '../../../entities/estimate'
import type { EstimateField, EstimationUnit } from '../../../entities/estimate'
import type { EstimateIssue } from '../lib/describeEstimateIssue'

const inputStyle = {
  height: 48,
  fontSize: '1.1rem',
  textAlign: 'center' as const,
  borderRadius: 'var(--radius-lg)',
}

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
  infoOpen: boolean
  onInfoOpen: () => void
  onInfoClose: () => void
}

/** The Best / Most likely / Worst input trio plus the false-precision and
 *  ascending-order guard nudges, shared by Workspace's ActiveItemPanel and
 *  ParticipantEstimateView's EstimateForm. Owns only the guards that are pure
 *  functions of the three raw values; validation (createEstimate) stays with
 *  each caller since it also drives UI outside this block. */
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
  infoOpen,
  onInfoOpen,
  onInfoClose,
}: ThreePointEstimateFieldsProps) {
  const granularity = UNIT_GRANULARITY[unit]
  const bestNum = Number(best)
  const likelyNum = Number(likely)
  const worstNum = Number(worst)

  const bestPrecision = best !== '' ? checkFalsePrecision(bestNum, granularity) : null
  const likelyPrecision =
    likely !== '' ? checkFalsePrecision(likelyNum, granularity) : null
  const worstPrecision = worst !== '' ? checkFalsePrecision(worstNum, granularity) : null

  const invalidProps = (field: EstimateField) =>
    issue?.fields.includes(field)
      ? { 'aria-invalid': true, 'aria-describedby': issueId }
      : {}

  return (
    <GroupBox
      label="Three-point estimate"
      info={THREE_POINT_ESTIMATE_INFO}
      infoOpen={infoOpen}
      onInfoOpen={onInfoOpen}
      onInfoClose={onInfoClose}
    >
      <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
        <Field style={{ flex: 1 }}>
          <FieldLabel htmlFor="best">{`Best case (${unit})`}</FieldLabel>
          <Input
            id="best"
            type="number"
            min={0}
            value={best}
            onChange={(e) => onBestChange(e.target.value)}
            {...invalidProps('best')}
            style={inputStyle}
          />
          {bestPrecision?.fired && (
            <GuardNote>Consider rounding to a meaningful value.</GuardNote>
          )}
        </Field>
        <Field style={{ flex: 1 }}>
          <FieldLabel htmlFor="likely">{`Most likely (${unit})`}</FieldLabel>
          <Input
            id="likely"
            type="number"
            min={0}
            value={likely}
            onChange={(e) => onLikelyChange(e.target.value)}
            {...invalidProps('likely')}
            style={inputStyle}
          />
          {likelyPrecision?.fired && (
            <GuardNote>Consider rounding to a meaningful value.</GuardNote>
          )}
        </Field>
        <Field style={{ flex: 1 }}>
          <FieldLabel htmlFor="worst">{`Worst case (${unit})`}</FieldLabel>
          <Input
            id="worst"
            type="number"
            min={0}
            value={worst}
            onChange={(e) => onWorstChange(e.target.value)}
            {...invalidProps('worst')}
            style={inputStyle}
          />
          {worstPrecision?.fired && (
            <GuardNote>Consider rounding to a meaningful value.</GuardNote>
          )}
        </Field>
      </div>
    </GroupBox>
  )
}
