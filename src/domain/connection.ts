import { FACILITATOR_PARTICIPANT_ID } from './participantId'
import type {
  ConnectionStatus,
  LiveConnectionStatus,
  SessionMode,
  SessionRole,
} from './types'

/** For a participant, the transport can report `'connected'` the instant it
 *  reaches ANY peer — including another participant, never the facilitator.
 *  Only once the facilitator's own peerId is confirmed (via its `announce`)
 *  is a participant actually "in" the session; until then this holds it at
 *  `'connecting'`, the same state used before any peer at all has joined. A
 *  facilitator's status passes through unchanged — it already means "at
 *  least one peer is here" for that role. */
export function deriveConnectionStatus(
  role: SessionRole,
  trackerStatus: ConnectionStatus,
  hasFacilitatorLink: boolean,
): ConnectionStatus {
  if (role === 'participant' && trackerStatus === 'connected' && !hasFacilitatorLink) {
    return 'connecting'
  }
  return trackerStatus
}

/** The connection state a live-session start or join sets. Everything else about the
 *  connection (peer count, status transitions) is written as the link evolves. */
export interface ConnectionEntry {
  mode: SessionMode
  role: SessionRole
  sessionId: string
  myName: string
  participantNames: Record<string, string>
  connectionStatus: LiveConnectionStatus
  hasEverConnected: boolean
  peerCount: number
}

/** Session codes are shared out of band, so tolerate stray whitespace and case. */
export function normalizeSessionCode(raw: string): string {
  return raw.trim().toUpperCase()
}

/** The connection state of a facilitator who has just started a live session. */
export function facilitatorStart(sessionCode: string): ConnectionEntry {
  return {
    mode: 'live',
    role: 'facilitator',
    sessionId: sessionCode,
    myName: 'Facilitator',
    participantNames: { [FACILITATOR_PARTICIPANT_ID]: 'Facilitator' },
    connectionStatus: 'connecting',
    hasEverConnected: false,
    peerCount: 0,
  }
}

/** The connection state of a participant joining `sessionCode` as `name`, or
 *  `null` when the code or the trimmed name is empty (the join does not proceed). */
export function participantJoin(
  sessionCode: string,
  name: string,
  participantId: string,
): (ConnectionEntry & { participantId: string }) | null {
  const code = normalizeSessionCode(sessionCode)
  const trimmedName = name.trim()
  if (code.length === 0 || trimmedName.length === 0) return null
  return {
    mode: 'live',
    role: 'participant',
    sessionId: code,
    myName: trimmedName,
    participantId,
    participantNames: { [participantId]: trimmedName },
    connectionStatus: 'connecting',
    hasEverConnected: false,
    peerCount: 0,
  }
}

/** Record a new link status. `hasEverConnected` latches true the first time the
 *  link reports connected, so "still trying to get in" stays distinguishable
 *  from "was in, lost it". */
export function withConnectionStatus(
  previous: { hasEverConnected: boolean },
  status: LiveConnectionStatus,
): { connectionStatus: LiveConnectionStatus; hasEverConnected: boolean } {
  return {
    connectionStatus: status,
    hasEverConnected: previous.hasEverConnected || status === 'connected',
  }
}

/** Leaving a live session that still has peers is destructive for them too, so
 *  the caller should ask for a second click first. */
export function leavingNeedsConfirm(mode: SessionMode, peerCount: number): boolean {
  return mode === 'live' && peerCount > 0
}

/** The facilitator broadcasts the session snapshot only while it is hosting a
 *  live session that has a code. */
export function shouldBroadcastSnapshot(
  mode: SessionMode,
  role: SessionRole,
  sessionId: string | null,
): boolean {
  return mode === 'live' && role === 'facilitator' && Boolean(sessionId)
}

/** Which `participantId -> display name` a client announces to its peers, or
 *  `null` when it has nothing to announce (not live, no name yet, or no id yet).
 *  The facilitator announces under the reserved facilitator id. */
export function announcementFor(connection: {
  mode: SessionMode
  role: SessionRole
  myName: string
  participantId: string
}): { participantId: string; name: string } | null {
  if (connection.mode !== 'live' || connection.myName.trim().length === 0) return null
  const participantId =
    connection.role === 'facilitator'
      ? FACILITATOR_PARTICIPANT_ID
      : connection.participantId
  if (participantId.length === 0) return null
  return { participantId, name: connection.myName }
}
