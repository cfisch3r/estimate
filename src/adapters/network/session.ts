import { createConnectionTracker } from './connection'
import { createTypedActions } from './actions'
import { createRecordingPeerConnection } from './recordingPeerConnection'
import type { DiagnosticsLog } from '../../application/ports/outbound/diagnosticsLog'
import type {
  JoinSession,
  TransportSession,
} from '../../application/ports/outbound/networkTransport'
import { shortPeerId, shortenPeerIdsIn } from '../../domain/diagnosis/peerIds'
import type { DiagnosticEvent } from '../../domain/diagnosis/types'

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
  /** Where the connection diagnosis records Trystero's facts (issue #229). */
  diagnostics?: DiagnosticsLog
  /** The connection class Trystero builds its WebRTC connections from; the
   *  browser's own when unset. */
  rtcPolyfill?: typeof RTCPeerConnection
}

/** Joins the Trystero room for a session. roomId = sessionId, the 6-char code from
 *  `generateSessionCode()` that the facilitator shares out of band (no deep link).
 *  Uses the Nostr signaling strategy per docs/technical/architecture.md (a test build swaps
 *  in a self-hosted relay instead — see ADR-007). */
export function joinSession(
  sessionId: string,
  options: JoinSessionOptions = {},
): TransportSession {
  const connection = createConnectionTracker()
  // The port promises never to throw.
  const record = (event: DiagnosticEvent) => options.diagnostics?.record(event)

  const room = joinSignalingRoom(sessionId, {
    password: options.password,
    onJoinError: ({ error, peerId }) => {
      record({
        kind: 'join-error',
        error: shortenPeerIdsIn(error, peerId ? [peerId] : []),
        ...(peerId ? { peer: shortPeerId(peerId) } : {}),
      })
      connection.handleJoinError()
    },
    rtcPolyfill: options.rtcPolyfill,
  })

  const actions = createTypedActions(room)

  room.onPeerJoin = (peerId) => {
    // Trystero may report a peer it already reported; the tracker ignores that.
    if (!connection.getState().peerIds.includes(peerId)) {
      record({ kind: 'peer-join', peer: shortPeerId(peerId) })
    }
    connection.handlePeerJoin(peerId)
  }
  room.onPeerLeave = (peerId) => {
    record({ kind: 'peer-leave', peer: shortPeerId(peerId) })
    connection.handlePeerLeave(peerId)
  }

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

/** The `JoinSession` port, recording into `diagnostics`: what the composition
 *  root provides to the live session. Every join shares one recording class, so
 *  a tab numbers its WebRTC attempts across reconnects. */
export function createJoinSession(deps: { diagnostics: DiagnosticsLog }): JoinSession {
  const { diagnostics } = deps
  const rtcPolyfill = createRecordingPeerConnection((event) => diagnostics.record(event))
  return (sessionId) => joinSession(sessionId, { diagnostics, rtcPolyfill })
}
