import { Card } from '../../../shared/ui'
import { useSingleInfoPopover } from '../../../shared/lib/useSingleInfoPopover'
import type { AggregateResult, EstimationUnit } from '../../../domain/estimate'
import type { LiveRound } from '../../../domain/types'
import { AggregatedRange } from '../../../features/reveal-results'
import { RoundCardHeader } from './RoundCardHeader'

interface FinalizedPanelProps {
  round: LiveRound
  finalResult: AggregateResult
  unit: EstimationUnit
  kicker: string
}

/** An item finalized in an earlier session (a loaded session file): its agreed
 *  range, and no form, since the facilitator would ignore a submission. */
export function FinalizedPanel({
  round,
  finalResult,
  unit,
  kicker,
}: FinalizedPanelProps) {
  const {
    openKey: infoOpen,
    open: openInfo,
    close: closeInfo,
  } = useSingleInfoPopover<'range'>()

  return (
    <Card elevation="sm">
      <RoundCardHeader kicker={kicker} item={round.item} />

      <AggregatedRange
        kind="finalized"
        range={finalResult}
        unit={unit}
        infoOpen={infoOpen === 'range'}
        onInfoOpen={() => openInfo('range')}
        onInfoClose={closeInfo}
      />

      <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
        This item is already estimated. Waiting for the facilitator to move on or reopen
        it.
      </p>
    </Card>
  )
}
