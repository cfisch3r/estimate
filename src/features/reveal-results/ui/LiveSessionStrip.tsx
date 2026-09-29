import { CopyIcon } from '@phosphor-icons/react/dist/csr/Copy'
import { Button, Tag } from '../../../shared/ui'
import type { LiveConnectionStatus } from '../../../entities/session'

interface LiveSessionStripProps {
  sessionId: string
  connectionStatus: LiveConnectionStatus
  peerCount: number
  hasEverConnected: boolean
  onReconnect: () => void
}

export function LiveSessionStrip({
  sessionId,
  connectionStatus,
  peerCount,
  hasEverConnected,
  onReconnect,
}: LiveSessionStripProps) {
  // Zero peers is NOT a connection loss for a facilitator: a participant closing
  // their tab at the end of a session is indistinguishable, at this layer, from a
  // link breaking. Only a join failure (`disconnected`, from onJoinError) is a
  // real fault. hasEverConnected (latched true once this room has had a peer,
  // never reset until a new session) is what lets "nobody has joined yet" read
  // differently from "everyone who was here has left".
  const statusTag =
    connectionStatus === 'connected'
      ? {
          variant: 'accent' as const,
          label: `${peerCount} participant${peerCount === 1 ? '' : 's'} connected`,
        }
      : connectionStatus === 'disconnected'
        ? { variant: 'outline' as const, label: 'Disconnected' }
        : hasEverConnected
          ? { variant: 'outline' as const, label: 'All participants disconnected' }
          : { variant: 'neutral' as const, label: 'Waiting for participants…' }

  return (
    <div className="workspace-strip">
      <span className="text-muted">Session code</span>
      <strong style={{ fontSize: '1.1rem', letterSpacing: '0.08em' }}>{sessionId}</strong>
      <Button
        icon
        variant="ghost"
        aria-label="Copy session code"
        onClick={() => {
          navigator.clipboard?.writeText(sessionId).catch(() => {})
        }}
      >
        <CopyIcon size={16} />
      </Button>
      <span style={{ flex: 1 }} />
      {connectionStatus === 'disconnected' && (
        <Button variant="ghost" onClick={onReconnect}>
          Reconnect
        </Button>
      )}
      <Tag variant={statusTag.variant}>{statusTag.label}</Tag>
    </div>
  )
}
