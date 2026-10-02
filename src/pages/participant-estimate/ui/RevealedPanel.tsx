import { Card, CardBody, GroupBox } from '../../../shared/ui'
import { RANGE_INFO } from '../../../shared/copy'
import { useSingleInfoPopover } from '../../../shared/lib/useSingleInfoPopover'
import {
  aggregateEstimates,
  EstimateTriple,
  RangeBar,
  UNIT_SUFFIX,
  type EstimationUnit,
} from '../../../entities/estimate'
import { announcedName, teammateLabel } from '../../../entities/participant'
import type { LiveRound } from '../../../entities/session'
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
  const suffix = UNIT_SUFFIX[unit]
  const aggregate =
    round.submissions.length > 0 ? aggregateEstimates(round.submissions) : null
  const {
    openKey: infoOpen,
    open: openInfo,
    close: closeInfo,
  } = useSingleInfoPopover<'range'>()

  return (
    <Card elevation="sm">
      <RoundCardHeader kicker={kicker} item={round.item} />

      {aggregate ? (
        <GroupBox
          label="Range (aggregated)"
          info={RANGE_INFO}
          infoOpen={infoOpen === 'range'}
          onInfoOpen={() => openInfo('range')}
          onInfoClose={closeInfo}
        >
          <RangeBar
            min={aggregate.min}
            max={aggregate.max}
            expected={aggregate.expected}
            ci90={aggregate.ci90}
            unitSuffix={suffix}
          />
        </GroupBox>
      ) : (
        <CardBody>No estimates were submitted before the reveal.</CardBody>
      )}

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 4 }}>
        {(() => {
          // Every non-self row consumes a teammate number (whether or not it
          // also has an announced name), so a given peer's "Teammate N" stays
          // put when a *different* peer's announce arrives. Prefer the announced
          // name.
          let teammateNo = 0
          return round.submissions.map((estimate) => {
            const isMe = estimate.participantId === participantId
            const ordinal = isMe ? 0 : ++teammateNo
            const label = isMe
              ? 'You'
              : (announcedName(participantNames, estimate.participantId) ??
                teammateLabel(ordinal))
            return (
              <li
                key={estimate.participantId}
                style={{ display: 'flex', justifyContent: 'space-between' }}
              >
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
            )
          })
        })()}
      </ul>

      <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
        Waiting for the facilitator to finalize or start a new round.
      </p>
    </Card>
  )
}
