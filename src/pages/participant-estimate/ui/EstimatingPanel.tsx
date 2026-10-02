import { Card } from '../../../shared/ui'
import type { EstimationUnit } from '../../../entities/estimate'
import type { LiveRound } from '../../../entities/session'
import type { SubmitResult } from '../../../features/submit-estimate'
import { EstimateForm } from './EstimateForm'
import { RoundCardHeader } from './RoundCardHeader'

interface EstimatingPanelProps {
  round: LiveRound
  unit: EstimationUnit
  kicker: string
  onSubmit: (best: number, likely: number, worst: number) => SubmitResult
}

export function EstimatingPanel({ round, unit, kicker, onSubmit }: EstimatingPanelProps) {
  // The roster (from the facilitator's snapshot) is the authoritative "who's
  // estimating" list — it replaces deriving the denominator from `peerCount`,
  // which is only correct while the full peer-to-peer mesh is intact.
  const totalEstimators = Math.max(round.roster.length, 1)
  const submitted = round.roster.filter((entry) => entry.submitted).length
  const statusLine = `${submitted} of ${totalEstimators} teammate${
    totalEstimators === 1 ? '' : 's'
  } ${submitted === 1 ? 'has' : 'have'} submitted so far.`

  return (
    <Card elevation="sm">
      <RoundCardHeader kicker={kicker} item={round.item} />
      <EstimateForm
        key={round.item.id}
        unit={unit}
        initial={null}
        submitLabel="Submit estimate"
        statusLine={statusLine}
        onSubmit={onSubmit}
      />
    </Card>
  )
}
