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

/** Whether this role holds the session's item list, and so has a session it
 *  can save and could lose: the facilitator in a live session, and the single
 *  user. A participant only mirrors the facilitator's broadcast round, so it
 *  never has anything to save. */
export function holdsItemList(role: SessionRole): boolean {
  return role === 'facilitator'
}

/** Why leaving the workspace needs a second click, if it does: `'unsaved'`
 *  when the session holds changes no saved file has (they would be lost),
 *  `'live-peers'` when a live session still has peers (leaving ends it for
 *  them too), `'unsaved-and-live-peers'` when both hold — each loss is named,
 *  neither hides the other — else `'none'`. */
export type LeaveConfirmation =
  'none' | 'unsaved' | 'live-peers' | 'unsaved-and-live-peers'

export function leaveConfirmation(
  mode: SessionMode,
  peerCount: number,
  unsaved: boolean,
): LeaveConfirmation {
  const livePeers = mode === 'live' && peerCount > 0
  if (unsaved && livePeers) return 'unsaved-and-live-peers'
  if (unsaved) return 'unsaved'
  if (livePeers) return 'live-peers'
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

/** The state a screen's access depends on: the connection, and whether a mode
 *  has started on the session (`useSessionStore`'s `started`). */
export type ScreenAccessState = {
  mode: SessionMode
  role: SessionRole
  sessionId: string | null
  hasEverConnected: boolean
  started: boolean
}

/** A screen that checks, on mount, whether the visitor belongs there. */
export type GuardedScreen = 'modeSelect' | 'join' | 'workspace' | 'estimate'

/**
 * Where a visitor of `screen` belongs instead, or `'allow'`: the one access
 * rule, so the guarded screens can't disagree about where a state belongs.
 *
 * - **workspace** — a live participant belongs on the estimate screen.
 * - **estimate** — only a participant who has joined: without a session back
 *   to mode selection, a facilitator to its Workspace.
 * - **modeSelect / join** (the entry screens, reached around the app's own
 *   leave only by the browser's Back button) — a joined participant goes back
 *   to the estimate screen, or to Join while still getting in; a started
 *   session to its Workspace. So Back never skips the leave confirmation or
 *   offers a load over a running session.
 */
export function screenAccessFor(
  state: ScreenAccessState,
  screen: GuardedScreen,
): 'allow' | 'workspace' | 'estimate' | 'modeSelect' | 'join' {
  const { mode, role, sessionId, hasEverConnected, started } = state
  const joined = role === 'participant' && sessionId !== null

  switch (screen) {
    case 'workspace':
      return mode === 'live' && role === 'participant' ? 'estimate' : 'allow'
    case 'estimate':
      if (sessionId === null) return 'modeSelect'
      return role === 'facilitator' ? 'workspace' : 'allow'
    case 'modeSelect':
    case 'join':
      if (joined) {
        if (hasEverConnected) return 'estimate'
        return screen === 'join' ? 'allow' : 'join'
      }
      return started ? 'workspace' : 'allow'
  }
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
