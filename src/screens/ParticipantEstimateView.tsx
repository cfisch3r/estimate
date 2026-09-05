import { Button, Card, CardBody, CardKicker, CardTitle, GuardNote } from '../components'
import { useSessionStore } from '../state/store'
import { useLeaveLiveSession } from './useLeaveLiveSession'

// TODO(#7): replace this placeholder with the real Best / Most likely / Worst
// estimate form (read-only item detail, live bias guards, submit -> sendEstimate).
export function ParticipantEstimateView() {
  const sessionId = useSessionStore((s) => s.sessionId)
  const myName = useSessionStore((s) => s.myName)
  const connectionStatus = useSessionStore((s) => s.connectionStatus)
  const leave = useLeaveLiveSession()

  const lostConnection = connectionStatus === 'disconnected'

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

      {lostConnection && (
        <GuardNote variant="banner" headline="Session connection lost">
          You&apos;ve been disconnected from the session. Ask the facilitator for a fresh
          code, or leave and rejoin.
        </GuardNote>
      )}

      <Button variant="ghost" onClick={leave}>
        Leave session
      </Button>
    </div>
  )
}
