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

/** The state a live-session start or join sets. Everything else about the
 *  connection (peer count, status transitions) is written as the link evolves. */
export interface SessionEntry {
  mode: SessionMode
  role: SessionRole
  sessionId: string
  myName: string
  participantId?: string
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
export function facilitatorStart(sessionCode: string): SessionEntry {
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
): (SessionEntry & { participantId: string }) | null {
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
