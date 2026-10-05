import { Button, LiveRegion, VisuallyHidden } from '../../../shared/ui'
import { useSubmitEstimate } from '../../../features/submit-estimate'
import { useLeaveLiveSession, useReconnect } from '../../../features/session-lifecycle'
import { useFocusHeadingOnChange } from '../model/useFocusHeadingOnChange'
import { useParticipantRound } from '../model/useParticipantRound'
import { useRoundAnnouncement } from '../model/useRoundAnnouncement'
import { ConnectionNotices } from './ConnectionNotices'
import { EstimatingPanel } from './EstimatingPanel'
import { LobbyPanel } from './LobbyPanel'
import { RevealedPanel } from './RevealedPanel'
import { WaitingPanel } from './WaitingPanel'

export function ParticipantEstimateView() {
  const round = useParticipantRound()
  const { kicker, unit, connectionPhase } = round
  const { submit, deliveryState } = useSubmitEstimate()
  const { reconnect, canReconnect } = useReconnect()
  const leave = useLeaveLiveSession()
  const panelRef = useFocusHeadingOnChange(
    `${round.view}:${round.liveRound?.item.id ?? ''}`,
  )

  let panel
  switch (round.view) {
    case 'lobby':
      panel = (
        <LobbyPanel
          kicker={kicker}
          myName={round.myName}
          connectionStatus={round.connectionStatus}
          connectionPhase={connectionPhase}
        />
      )
      break
    case 'revealed':
      panel = (
        <RevealedPanel
          round={round.liveRound}
          unit={unit}
          kicker={kicker}
          participantId={round.participantId}
          participantNames={round.participantNames}
        />
      )
      break
    case 'waiting':
      panel = (
        <WaitingPanel
          round={round.liveRound}
          unit={unit}
          kicker={kicker}
          onSubmit={submit}
          deliveryState={deliveryState}
          connectionPhase={connectionPhase}
        />
      )
      break
    case 'estimating':
      panel = (
        <EstimatingPanel
          round={round.liveRound}
          unit={unit}
          kicker={kicker}
          onSubmit={submit}
        />
      )
      break
  }

  const announcement = useRoundAnnouncement(round.view, round.connectionStatus)

  return (
    <div
      style={{
        maxWidth: 560,
        margin: '0 auto',
        padding: 'var(--space-8) var(--space-4)',
        display: 'grid',
        gap: 'var(--space-4)',
      }}
    >
      <div ref={panelRef}>{panel}</div>

      <LiveRegion>
        <VisuallyHidden>{announcement}</VisuallyHidden>
      </LiveRegion>

      {/* A dropped link usually rebuilds itself within seconds, so the first
       *  stage stays quiet and offers no action — there is nothing useful to do
       *  yet. Only once that window passes is this a problem worth raising. */}
      <ConnectionNotices
        connectionPhase={connectionPhase}
        onReconnect={reconnect}
        canReconnect={canReconnect}
      />

      <Button variant="ghost" onClick={leave}>
        Leave session
      </Button>
    </div>
  )
}
