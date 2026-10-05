import { GroupBox } from '../../../shared/ui'
import { RANGE_INFO } from '../../../shared/copy'
import {
  aggregateEstimates,
  RangeBar,
  UNIT_SUFFIX,
  type Estimate,
  type EstimationUnit,
} from '../../../entities/estimate'

interface AggregatedRangeProps {
  submissions: Estimate[]
  unit: EstimationUnit
  infoOpen: boolean
  onInfoOpen: () => void
  onInfoClose: () => void
}

/** The revealed round's aggregated range as a labelled range bar, shared by the
 *  facilitator's panel and the participant's revealed view. Renders nothing when
 *  no estimates were submitted — callers decide what to say in that case. */
export function AggregatedRange({
  submissions,
  unit,
  infoOpen,
  onInfoOpen,
  onInfoClose,
}: AggregatedRangeProps) {
  if (submissions.length === 0) return null
  const aggregate = aggregateEstimates(submissions)

  return (
    <GroupBox
      label="Range (aggregated)"
      info={RANGE_INFO}
      infoOpen={infoOpen}
      onInfoOpen={onInfoOpen}
      onInfoClose={onInfoClose}
    >
      <RangeBar
        min={aggregate.min}
        max={aggregate.max}
        expected={aggregate.expected}
        ci90={aggregate.ci90}
        unitSuffix={UNIT_SUFFIX[unit]}
      />
    </GroupBox>
  )
}
