import { Field, FieldLabel, Input } from './Field'
import { GuardNote } from './GuardNote'
import { GroupBox } from './GroupBox'
import { THREE_POINT_ESTIMATE_INFO } from '../copy/groupInfo'
import { checkAscendingOrder, checkFalsePrecision, UNIT_GRANULARITY } from '../calc'
import type { EstimationUnit } from '../calc'

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
  validationError: string | null
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
  validationError,
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

  const ascendingGuard = checkAscendingOrder(
    best === '' ? null : bestNum,
    likely === '' ? null : likelyNum,
    worst === '' ? null : worstNum,
  )
  const orderingWarning =
    !validationError && ascendingGuard.fired
      ? 'Values should ascend: best ≤ likely ≤ worst.'
      : null

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
            style={inputStyle}
          />
          {worstPrecision?.fired && (
            <GuardNote>Consider rounding to a meaningful value.</GuardNote>
          )}
        </Field>
      </div>
      {orderingWarning && (
        <GuardNote variant="banner" headline="Out of order">
          {orderingWarning}
        </GuardNote>
      )}
    </GroupBox>
  )
}
