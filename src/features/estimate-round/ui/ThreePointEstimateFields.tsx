import { Field, FieldLabel, Input } from '../../../shared/ui/Field'
import { GuardNote } from '../../../shared/ui/GuardNote'
import { GroupBox } from '../../../shared/ui/GroupBox'
import { THREE_POINT_ESTIMATE_INFO } from '../../../shared/copy'
import { checkFalsePrecision, UNIT_GRANULARITY } from '../../../entities/estimate'
import type { EstimateField, EstimationUnit } from '../../../entities/estimate'
import { describePartialOrdering, type EstimateIssue } from '../lib/describeEstimateIssue'

/** The id of the banner that explains a fully filled, invalid entry; the invalid
 *  inputs point at it via aria-describedby. */
export const ESTIMATE_ISSUE_ID = 'estimate-issue'
const ORDER_NUDGE_ID = 'estimate-order-nudge'

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
  /** Why a fully filled entry is invalid, or null. */
  issue: EstimateIssue | null
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

  // A descending pair is flagged as soon as both of its values are typed, before
  // the third is filled in; a fully filled invalid entry is explained by `issue`.
  const orderingNudge = issue
    ? null
    : describePartialOrdering(
        {
          best: best === '' ? null : bestNum,
          likely: likely === '' ? null : likelyNum,
          worst: worst === '' ? null : worstNum,
        },
        unit,
      )
  const activeIssue = issue ?? orderingNudge
  const describedBy = issue
    ? ESTIMATE_ISSUE_ID
    : orderingNudge
      ? ORDER_NUDGE_ID
      : undefined
  const invalidProps = (field: EstimateField) =>
    activeIssue?.fields.includes(field)
      ? { 'aria-invalid': true, 'aria-describedby': describedBy }
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
      {orderingNudge && (
        <GuardNote variant="banner" headline={orderingNudge.headline} id={ORDER_NUDGE_ID}>
          {orderingNudge.message}
        </GuardNote>
      )}
    </GroupBox>
  )
}
