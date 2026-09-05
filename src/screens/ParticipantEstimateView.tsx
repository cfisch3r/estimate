import { Button, Card, CardBody, CardKicker, CardTitle } from '../components'
import { useSessionStore } from '../state/store'
import { useNetworkSession } from '../network'

// TODO(#7): replace this placeholder with the real Best / Most likely / Worst
// estimate form (read-only item detail, live bias guards, submit -> sendEstimate).
export function ParticipantEstimateView() {
  const sessionId = useSessionStore((s) => s.sessionId)
  const myName = useSessionStore((s) => s.myName)
  const connectionStatus = useSessionStore((s) => s.connectionStatus)
  const leaveLiveSession = useSessionStore((s) => s.leaveLiveSession)
  const { disconnect } = useNetworkSession()

  function handleLeave() {
    disconnect()
    leaveLiveSession() // also routes back to the create screen
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
      <Card elevation="sm">
        <CardKicker>Session {sessionId}</CardKicker>
        <CardTitle>
          {connectionStatus === 'connected' ? `You're in, ${myName}` : 'Connecting…'}
        </CardTitle>
        <CardBody>
          {connectionStatus === 'connected'
            ? 'Waiting for the facilitator to start the first item.'
            : 'Establishing the peer connection.'}
        </CardBody>
      </Card>

      <Button variant="ghost" onClick={handleLeave}>
        Leave session
      </Button>
    </div>
  )
}
