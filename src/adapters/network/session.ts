import { createConnectionTracker } from './connection'
import { createTypedActions } from './actions'
import { createRecordingPeerConnection } from './recordingPeerConnection'
import type { DiagnosticsLog } from '../../application/ports/outbound/diagnosticsLog'
import type {
  FacilitatorSession,
  JoinSession,
  LiveSession,
  ParticipantSession,
} from '../../application/ports/outbound/networkTransport'
import { shortPeerId, shortenPeerIdsIn } from '../../domain/diagnosis/peerIds'
import type { DiagnosticEvent } from '../../domain/diagnosis/types'
import { FACILITATOR_PARTICIPANT_ID } from '../../domain/participantId'

/** Resolved once, at module init, via top-level await — not inside each join.
 *  A dynamic `import()` behind a build-time-constant condition is the pattern the
 *  wider ecosystem uses to keep test/dev-only code out of a production bundle
 *  (e.g. Mock Service Worker's own guarded-dynamic-import setup): once Vite inlines
 *  `import.meta.env.MODE` as a literal, an unreached `import()` call is ordinary
 *  dead code, so Rollup never emits that chunk — confirmed by bundle inspection,
 *  see ADR-007. Resolving it once here (rather than per join) keeps
 *  joining synchronous, so `LiveSessionApi.connect()` and its callers don't need
 *  to change at all. */
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
 *  in a self-hosted relay instead — see ADR-007). What both roles share; each
 *  role's session adds its own messages on top. */
function openRoom(sessionId: string, options: JoinSessionOptions) {
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

  const shared: LiveSession = {
    sendAnnounce: actions.sendAnnounce,
    onAnnounce: actions.onAnnounce,
    onPeerJoin: connection.onPeerJoin,
    onPeerLeave: connection.onPeerLeave,
    onConnectionStateChange: connection.onStateChange,
    getConnectionState: connection.getState,
    leave: () => void room.leave(),
  }
  return { actions, connection, shared }
}

/** The facilitator's session. It installs no `syncState` listener, so a
 *  snapshot another peer sends it goes nowhere. */
export function joinAsFacilitator(
  sessionId: string,
  options: JoinSessionOptions = {},
): FacilitatorSession {
  const { actions, shared } = openRoom(sessionId, options)
  return {
    ...shared,
    sendSnapshot: actions.sendSyncState,
    onEstimate: actions.onEstimate,
    onSnapshotRequest: actions.onRequestSnapshot,
  }
}

/** A request error Trystero would give for a link that's gone, so the shared
 *  retry policy treats "no facilitator yet" like a dead link (ADR-003,
 *  "Acknowledged submissions"). */
function noFacilitator(): Error {
  return Object.assign(new Error("The facilitator's peer isn't known yet"), {
    kind: 'disconnected',
  })
}

/** A participant's session. It takes the facilitator's peer from the announce
 *  that carries the facilitator's participant id, hands on only that peer's
 *  snapshots, and sends estimates and snapshot requests only to it. Never a
 *  broadcast: an estimate on every peer's wire is what targeting prevents
 *  (ADR-003, "Single owner"). The announce is the only evidence of who the
 *  facilitator is, so a peer that announces the facilitator's id takes its
 *  place, as the trust boundary in the collaboration-mode concept says. */
export function joinAsParticipant(
  sessionId: string,
  options: JoinSessionOptions = {},
): ParticipantSession {
  const { actions, connection, shared } = openRoom(sessionId, options)
  let facilitatorPeerId: string | null = null
  const changeListeners = new Set<(present: boolean) => void>()
  const setFacilitator = (peerId: string | null) => {
    if (peerId === facilitatorPeerId) return
    facilitatorPeerId = peerId
    for (const listener of changeListeners) listener(peerId !== null)
  }

  actions.onAnnounce((announce, peerId) => {
    if (announce.participantId === FACILITATOR_PARTICIPANT_ID) setFacilitator(peerId)
  })
  // Registered before anyone else can subscribe, so by the time the
  // controller's own peer-leave handler runs, the facilitator is already gone.
  connection.onPeerLeave((peerId) => {
    if (peerId === facilitatorPeerId) setFacilitator(null)
  })

  return {
    ...shared,
    hasFacilitator: () => facilitatorPeerId !== null,
    onFacilitatorChange: (cb) => {
      changeListeners.add(cb)
      return () => changeListeners.delete(cb)
    },
    sendEstimate: (itemId, estimate, round) =>
      facilitatorPeerId === null
        ? Promise.reject(noFacilitator())
        : actions.sendEstimate(itemId, estimate, round, facilitatorPeerId),
    requestSnapshot: () =>
      facilitatorPeerId === null
        ? Promise.reject(noFacilitator())
        : actions.requestSnapshot(facilitatorPeerId),
    onFacilitatorSnapshot: (cb) =>
      actions.onSyncState((snapshot, peerId) => {
        // A snapshot from anyone else, or from before the facilitator
        // announced itself, is dropped: the participant pulls one as soon as it
        // knows the facilitator.
        if (peerId === facilitatorPeerId) cb(snapshot)
      }),
  }
}

/** The `JoinSession` port, recording into `diagnostics`: what the composition
 *  root provides to the live session. Every join shares one recording class, so
 *  a tab numbers its WebRTC attempts across reconnects. */
export function createJoinSession(deps: { diagnostics: DiagnosticsLog }): JoinSession {
  const { diagnostics } = deps
  const rtcPolyfill = createRecordingPeerConnection((event) => diagnostics.record(event))
  return {
    asFacilitator: (sessionId) =>
      joinAsFacilitator(sessionId, { diagnostics, rtcPolyfill }),
    asParticipant: (sessionId) =>
      joinAsParticipant(sessionId, { diagnostics, rtcPolyfill }),
  }
}
