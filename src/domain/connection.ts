import { FACILITATOR_PARTICIPANT_ID } from './participantId'
import type {
  ConnectionStatus,
  LiveConnectionStatus,
  ParticipantAnnounce,
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

/** Why leaving the workspace needs a second click, if it does: `'unsaved'`
 *  when the session holds changes no saved file has (they would be lost), else
 *  `'live-peers'` when a live session still has peers (leaving ends it for
 *  them too), else `'none'`. Unsaved changes win because they are the larger
 *  loss and the one the user can still prevent by saving. */
export type LeaveConfirmation = 'none' | 'unsaved' | 'live-peers'

export function leaveConfirmation(
  mode: SessionMode,
  peerCount: number,
  unsaved: boolean,
): LeaveConfirmation {
  if (unsaved) return 'unsaved'
  if (mode === 'live' && peerCount > 0) return 'live-peers'
  return 'none'
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

/** Where a connection state belongs, for a screen gated to one role: the
 *  single-user/facilitator Workspace, or the live participant's estimate
 *  screen. `'allow'` means the given screen already matches that state;
 *  otherwise the screen the caller should redirect to instead. Centralizes
 *  the access rule so the two gated screens can't disagree about where a
 *  given state belongs. */
export function screenAccessFor(
  connection: { mode: SessionMode; role: SessionRole; sessionId: string | null },
  screen: 'workspace' | 'estimate',
): 'allow' | 'workspace' | 'estimate' | 'modeSelect' {
  const { mode, role, sessionId } = connection
  const isLiveParticipant = mode === 'live' && role === 'participant'

  if (screen === 'workspace') {
    return isLiveParticipant ? 'estimate' : 'allow'
  }

  if (sessionId === null) return 'modeSelect'
  if (role === 'facilitator') return 'workspace'
  return 'allow'
}

/** Which `participantId -> display name` a client announces to its peers, or
 *  `null` when it has nothing to announce (not live, no name yet, or no id yet).
 *  The facilitator announces under the reserved facilitator id. */
export function announcementFor(connection: {
  mode: SessionMode
  role: SessionRole
  myName: string
  participantId: string
}): ParticipantAnnounce | null {
  if (connection.mode !== 'live' || connection.myName.trim().length === 0) return null
  const participantId =
    connection.role === 'facilitator'
      ? FACILITATOR_PARTICIPANT_ID
      : connection.participantId
  if (participantId.length === 0) return null
  return { participantId, name: connection.myName }
}
