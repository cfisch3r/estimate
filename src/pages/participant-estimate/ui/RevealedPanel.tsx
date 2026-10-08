import { Card, CardBody } from '../../../shared/ui'
import { useSingleInfoPopover } from '../../../shared/lib/useSingleInfoPopover'
import { EstimateTriple } from '../../../entities/session'
import type { EstimationUnit } from '../../../domain/estimate'
import type { LiveRound } from '../../../domain/types'
import { AggregatedRange } from '../../../features/reveal-results'
import { buildRevealedRows } from '../model/buildRevealedRows'
import { RoundCardHeader } from './RoundCardHeader'

interface RevealedPanelProps {
  round: LiveRound
  unit: EstimationUnit
  kicker: string
  participantId: string
  participantNames: Record<string, string>
}

export function RevealedPanel({
  round,
  unit,
  kicker,
  participantId,
  participantNames,
}: RevealedPanelProps) {
  const {
    openKey: infoOpen,
    open: openInfo,
    close: closeInfo,
  } = useSingleInfoPopover<'range'>()

  const rows = buildRevealedRows(round.submissions, participantId, participantNames)

  return (
    <Card elevation="sm">
      <RoundCardHeader kicker={kicker} item={round.item} />

      {round.submissions.length > 0 ? (
        <AggregatedRange
          submissions={round.submissions}
          unit={unit}
          infoOpen={infoOpen === 'range'}
          onInfoOpen={() => openInfo('range')}
          onInfoClose={closeInfo}
        />
      ) : (
        <CardBody>No estimates were submitted before the reveal.</CardBody>
      )}

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 4 }}>
        {rows.map(({ participantId: id, label, estimate }) => (
          <li key={id} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{label}</span>
            <span>
              <EstimateTriple
                best={estimate.best}
                likely={estimate.likely}
                worst={estimate.worst}
                unit={unit}
              />
            </span>
          </li>
        ))}
      </ul>

      <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
        Waiting for the facilitator to finalize or start a new round.
      </p>
    </Card>
  )
}
