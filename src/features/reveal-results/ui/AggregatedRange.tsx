import { GroupBox } from '../../../shared/ui'
import { RANGE_INFO } from '../../../shared/copy'
import {
  UNIT_SUFFIX,
  type AggregateValues,
  type EstimationUnit,
} from '../../../domain/estimate'
import { RangeBar } from '../../../entities/estimate'

const LABEL = {
  aggregated: 'Range (aggregated)',
  finalized: 'Range (finalized)',
} as const

interface AggregatedRangeProps {
  /** `aggregated` for a revealed round's submissions, `finalized` for an
   *  item's saved result. */
  kind: keyof typeof LABEL
  range: AggregateValues
  unit: EstimationUnit
  infoOpen: boolean
  onInfoOpen: () => void
  onInfoClose: () => void
}

/** An aggregated range as a labelled range bar, shared by the facilitator's
 *  panel and the participant's revealed and finalized views. Callers decide
 *  which range to show, and what to say when there is none. */
export function AggregatedRange({
  kind,
  range,
  unit,
  infoOpen,
  onInfoOpen,
  onInfoClose,
}: AggregatedRangeProps) {
  return (
    <GroupBox
      label={LABEL[kind]}
      info={RANGE_INFO}
      infoOpen={infoOpen}
      onInfoOpen={onInfoOpen}
      onInfoClose={onInfoClose}
    >
      <RangeBar
        min={range.min}
        max={range.max}
        expected={range.expected}
        ci90={range.ci90}
        unitSuffix={UNIT_SUFFIX[unit]}
      />
    </GroupBox>
  )
}
