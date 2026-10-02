import { CircleNotchIcon } from '@phosphor-icons/react/dist/csr/CircleNotch'
import { Button, GuardNote, LiveRegion, VisuallyHidden } from '../../../shared/ui'
import { useNetworkSession } from '../../../entities/session'
import { useSubmitEstimate } from '../../../features/submit-estimate'
import { useLeaveLiveSession } from '../../../features/session-lifecycle'
import { useFocusHeadingOnChange } from '../model/useFocusHeadingOnChange'
import { useParticipantRound } from '../model/useParticipantRound'
import { EstimatingPanel } from './EstimatingPanel'
import { LobbyPanel } from './LobbyPanel'
import { RevealedPanel } from './RevealedPanel'
import { WaitingPanel } from './WaitingPanel'

export function ParticipantEstimateView() {
  const round = useParticipantRound()
  const { sessionId, kicker, unit, connectionPhase } = round
  const { submit, deliveryState } = useSubmitEstimate()
  const { connect } = useNetworkSession()
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

  // What a screen-reader user can't see happen: the focused heading says which
  // item this is, this says what changed about it.
  const announcement =
    round.view === 'waiting'
      ? 'Estimate submitted.'
      : round.view === 'revealed'
        ? 'Estimates revealed.'
        : ''

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
      <LiveRegion>
        {connectionPhase === 'reconnecting' && (
          <div
            className="card-meta"
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
          >
            <CircleNotchIcon size={16} weight="bold" className="spin" />
            Reconnecting…
          </div>
        )}
      </LiveRegion>

      <LiveRegion role="alert">
        {connectionPhase === 'lost' && (
          <GuardNote variant="banner" headline="Session connection lost">
            <p style={{ margin: '0 0 var(--space-2)' }}>
              You&apos;ve been disconnected and the session hasn&apos;t come back on its
              own.
            </p>
            <Button
              variant="primary"
              onClick={() => sessionId && connect(sessionId)}
              disabled={!sessionId}
            >
              Reconnect
            </Button>
          </GuardNote>
        )}
      </LiveRegion>

      <Button variant="ghost" onClick={leave}>
        Leave session
      </Button>
    </div>
  )
}
