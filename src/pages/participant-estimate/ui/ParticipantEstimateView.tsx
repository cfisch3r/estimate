import { CircleNotchIcon } from '@phosphor-icons/react/dist/csr/CircleNotch'
import { Button, GuardNote } from '../../../shared/ui'
import { useNetworkSession } from '../../../entities/session'
import { useSubmitEstimate } from '../../../features/estimate-round'
import { useLeaveLiveSession } from '../../../features/session-lifecycle'
import { useParticipantRound } from '../model/useParticipantRound'
import { EstimatingPanel } from './EstimatingPanel'
import { LobbyPanel } from './LobbyPanel'
import { RevealedPanel } from './RevealedPanel'
import { WaitingPanel } from './WaitingPanel'

export function ParticipantEstimateView() {
  const {
    view,
    liveRound,
    unit,
    sessionId,
    kicker,
    myName,
    connectionStatus,
    connectionPhase,
    participantId,
    participantNames,
  } = useParticipantRound()
  const { submit, deliveryState } = useSubmitEstimate()
  const { connect } = useNetworkSession()
  const leave = useLeaveLiveSession()

  let panel
  if (!liveRound || view === 'lobby') {
    panel = (
      <LobbyPanel
        kicker={kicker}
        myName={myName}
        connectionStatus={connectionStatus}
        connectionPhase={connectionPhase}
      />
    )
  } else if (view === 'revealed') {
    panel = (
      <RevealedPanel
        round={liveRound}
        unit={unit}
        kicker={kicker}
        participantId={participantId}
        participantNames={participantNames}
      />
    )
  } else if (view === 'waiting') {
    panel = (
      <WaitingPanel
        round={liveRound}
        unit={unit}
        kicker={kicker}
        onSubmit={submit}
        deliveryState={deliveryState}
        connectionPhase={connectionPhase}
      />
    )
  } else {
    panel = (
      <EstimatingPanel round={liveRound} unit={unit} kicker={kicker} onSubmit={submit} />
    )
  }

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
      {panel}

      {/* A dropped link usually rebuilds itself within seconds, so the first
       *  stage stays quiet and offers no action — there is nothing useful to do
       *  yet. Only once that window passes is this a problem worth raising. */}
      {connectionPhase === 'reconnecting' && (
        <div
          className="card-meta"
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
        >
          <CircleNotchIcon size={16} weight="bold" className="spin" />
          Reconnecting…
        </div>
      )}

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

      <Button variant="ghost" onClick={leave}>
        Leave session
      </Button>
    </div>
  )
}
