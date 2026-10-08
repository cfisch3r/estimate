import { Card, CardBody, CardKicker, CardTitle } from '../../../shared/ui'
import type { ConnectionPhase } from '../../../shared/lib/useConnectionPhase'
import type { LiveConnectionStatus } from '../../../domain/types'

interface LobbyPanelProps {
  kicker: string
  myName: string
  connectionStatus: LiveConnectionStatus
  connectionPhase: ConnectionPhase
}

export function LobbyPanel({
  kicker,
  myName,
  connectionStatus,
  connectionPhase,
}: LobbyPanelProps) {
  // While the connection is down, the spinner or banner below owns the
  // explanation — the card must not also claim to be "Establishing the peer
  // connection", which reads as a first join that never happened.
  if (connectionPhase !== 'ok') {
    return (
      <Card elevation="sm">
        <CardKicker>{kicker}</CardKicker>
        <CardTitle as="h1">Session interrupted</CardTitle>
        <CardBody>You were in the session; the connection dropped.</CardBody>
      </Card>
    )
  }

  return (
    <Card elevation="sm">
      <CardKicker>{kicker}</CardKicker>
      <CardTitle as="h1">
        {connectionStatus === 'connected' ? `You're in, ${myName}` : 'Connecting…'}
      </CardTitle>
      <CardBody>
        {connectionStatus === 'connected'
          ? 'Waiting for the facilitator to start the first item.'
          : 'Establishing the peer connection.'}
      </CardBody>
    </Card>
  )
}
