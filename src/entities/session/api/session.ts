import { createConnectionTracker, type ConnectionState } from './connection'
import {
  createTypedActions,
  type ParticipantAnnounce,
  type SessionSnapshot,
} from './actions'
import type { Estimate } from '../../estimate'

type Unsubscribe = () => void

/** Resolved once, at module init, via top-level await — not inside `joinSession()`.
 *  A dynamic `import()` behind a build-time-constant condition is the pattern the
 *  wider ecosystem uses to keep test/dev-only code out of a production bundle
 *  (e.g. Mock Service Worker's own guarded-dynamic-import setup): once Vite inlines
 *  `import.meta.env.MODE` as a literal, an unreached `import()` call is ordinary
 *  dead code, so Rollup never emits that chunk — confirmed by bundle inspection,
 *  see ADR-007. Resolving it once here (rather than per `joinSession()` call) keeps
 *  `joinSession` itself synchronous, so `NetworkProvider.connect()` and its callers
 *  don't need to change at all. */
const { joinSignalingRoom } =
  import.meta.env.MODE === 'e2e'
    ? await import('./signaling.wsRelay')
    : await import('./signaling')

export interface JoinSessionOptions {
  password?: string
}

export interface NetworkSession {
  sendEstimate(
    itemId: string,
    estimate: Estimate,
    round: number,
    target: string,
  ): Promise<void>
  sendSyncState(snapshot: SessionSnapshot): void
  sendAnnounce(announce: ParticipantAnnounce): void
  /** A peer that just (re)connected pulls the facilitator's current snapshot
   *  itself (ADR-003, "Snapshot delivery: pull on arrival"). */
  requestSnapshot(targetPeerId: string): Promise<SessionSnapshot>
  onEstimate(
    cb: (
      itemId: string,
      estimate: Estimate,
      peerId: string,
      round: number | undefined,
    ) => void,
  ): Unsubscribe
  onSyncState(cb: (snapshot: SessionSnapshot, peerId: string) => void): Unsubscribe
  onAnnounce(cb: (announce: ParticipantAnnounce, peerId: string) => void): Unsubscribe
  /** Facilitator-only: answers a peer's `requestSnapshot` pull. */
  onRequestSnapshot(cb: () => SessionSnapshot): Unsubscribe
  onPeerJoin(cb: (peerId: string) => void): Unsubscribe
  onPeerLeave(cb: (peerId: string) => void): Unsubscribe
  onConnectionStateChange(cb: (state: ConnectionState) => void): Unsubscribe
  getConnectionState(): ConnectionState
  leave(): void
}

/** Joins the Trystero room for a session. roomId = sessionId, the 6-char code from
 *  `generateSessionCode()` that the facilitator shares out of band (no deep link).
 *  Uses the Nostr signaling strategy per docs/architecture.md (a test build swaps
 *  in a self-hosted relay instead — see ADR-007). */
export function joinSession(
  sessionId: string,
  options: JoinSessionOptions = {},
): NetworkSession {
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
    leave: () => room.leave(),
  }
}
