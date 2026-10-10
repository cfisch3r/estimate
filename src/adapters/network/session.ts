import { createConnectionTracker } from './connection'
import { createTypedActions } from './actions'
import type { TransportSession } from '../../application/ports/outbound/networkTransport'

/** Resolved once, at module init, via top-level await — not inside `joinSession()`.
 *  A dynamic `import()` behind a build-time-constant condition is the pattern the
 *  wider ecosystem uses to keep test/dev-only code out of a production bundle
 *  (e.g. Mock Service Worker's own guarded-dynamic-import setup): once Vite inlines
 *  `import.meta.env.MODE` as a literal, an unreached `import()` call is ordinary
 *  dead code, so Rollup never emits that chunk — confirmed by bundle inspection,
 *  see ADR-007. Resolving it once here (rather than per `joinSession()` call) keeps
 *  `joinSession` itself synchronous, so `LiveSessionApi.connect()` and its callers
 *  don't need to change at all. */
const { joinSignalingRoom } =
  import.meta.env.MODE === 'e2e'
    ? await import('./signaling.wsRelay')
    : await import('./signaling')

export interface JoinSessionOptions {
  password?: string
}

/** Joins the Trystero room for a session. roomId = sessionId, the 6-char code from
 *  `generateSessionCode()` that the facilitator shares out of band (no deep link).
 *  Uses the Nostr signaling strategy per docs/architecture.md (a test build swaps
 *  in a self-hosted relay instead — see ADR-007). */
export function joinSession(
  sessionId: string,
  options: JoinSessionOptions = {},
): TransportSession {
  const connection = createConnectionTracker()

  const room = joinSignalingRoom(sessionId, {
    password: options.password,
    onJoinError: () => connection.handleJoinError(),
  })

  const actions = createTypedActions(room)

  room.onPeerJoin = (peerId) => connection.handlePeerJoin(peerId)
  room.onPeerLeave = (peerId) => connection.handlePeerLeave(peerId)

  return {
    sendEstimate: actions.sendEstimate,
    sendSyncState: actions.sendSyncState,
    sendAnnounce: actions.sendAnnounce,
    requestSnapshot: actions.requestSnapshot,
    onEstimate: actions.onEstimate,
    onSyncState: actions.onSyncState,
    onAnnounce: actions.onAnnounce,
    onRequestSnapshot: actions.onRequestSnapshot,
    onPeerJoin: connection.onPeerJoin,
    onPeerLeave: connection.onPeerLeave,
    onConnectionStateChange: connection.onStateChange,
    getConnectionState: connection.getState,
    leave: () => void room.leave(),
  }
}
