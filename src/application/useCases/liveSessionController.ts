import {
  announcementFor,
  deriveConnectionStatus,
  shouldBroadcastSnapshot,
} from '../../domain/connection'
import { needsResend, roundKey } from '../../domain/resend'
import { shouldPruneDeparted } from '../../domain/roster'
import { buildSessionSnapshot, snapshotChangeKey } from '../../domain/snapshot'
import type { DiagnosticEvent } from '../../domain/diagnosis/types'
import type { LiveConnectionStatus } from '../../domain/types'
import type { LiveSessionApi } from './liveSessionContext'
import type { DiagnosticsLog } from '../ports/outbound/diagnosticsLog'
import type {
  ConnectionState,
  FacilitatorSession,
  JoinSession,
  LiveSession,
  ParticipantSession,
} from '../ports/outbound/networkTransport'
import { useConnectionStore } from '../stores/connection'
import { useRoundStore } from '../stores/round'
import { useSessionStore } from '../stores/session'
import { applyFacilitatorSnapshot } from './applyFacilitatorSnapshot'
import { withKindDrivenRetry } from './retryPolicy'

export interface LiveSessionController {
  /** The `LiveSessionApi` handle the use-case hooks reach through `useLiveSession`. */
  api: LiveSessionApi
  /** Leave the room and stop bridging events, without touching the stores. */
  dispose: () => void
}

/** Owns the single live peer session for the app and bridges its events into the
 *  session, connection and round stores, so screens only ever read connection
 *  state from `useConnectionStore` and round state from the round/session
 *  stores. Wiring only: what a snapshot contains, when a submission needs
 *  re-sending and when a departed participant is forgotten are pure policies in
 *  `src/domain`. Framework-free: the transport is passed in, so it can be tested
 *  against a fake and the React provider stays a thin shell. */
export function createLiveSessionController(deps: {
  joinSession: JoinSession
  /** Where the connection diagnosis records the session start and the status the
   *  user saw (issue #229). */
  diagnostics: DiagnosticsLog
}): LiveSessionController {
  // The open session, and the same session under its role's type: exactly one
  // of `facilitator` and `participant` is set while `live` is.
  let live: LiveSession | null = null
  let facilitator: FacilitatorSession | null = null
  let participant: ParticipantSession | null = null
  let unsubscribe: (() => void) | null = null

  // The port promises never to throw.
  const record = (event: DiagnosticEvent) => deps.diagnostics.record(event)

  // The status line the diagnosis shows is the one the user saw, so it records
  // the derived status, and only when that changes. Null until a live session
  // started, so ending a session that never went live records nothing.
  let lastRecordedStatus: LiveConnectionStatus | null = null
  const recordStatus = (status: LiveConnectionStatus) => {
    if (status === lastRecordedStatus) return
    lastRecordedStatus = status
    record({ kind: 'status', status })
  }

  function teardown() {
    unsubscribe?.()
    unsubscribe = null
    live?.leave()
    live = null
    facilitator = null
    participant = null
  }

  // Facilitator only: Trystero's onPeerLeave gives a peerId (a connection), not a
  // participantId (a person) — this map, built from inbound announces, is what
  // lets a departure be resolved back to the participant who left, and lets the
  // roster report who's currently connected.
  const peerParticipants = new Map<string, string>()

  // Writes connectionStatus/peerCount into the store from the transport's raw
  // state, gated through deriveConnectionStatus so a participant isn't told
  // it's connected before its session knows the facilitator.
  const syncConnectionStatus = (trackerState: ConnectionState) => {
    const { role, setConnectionStatus, setPeerCount } = useConnectionStore.getState()
    const status = deriveConnectionStatus(
      role,
      trackerState.status,
      participant?.hasFacilitator() ?? false,
    )
    setConnectionStatus(status)
    setPeerCount(trackerState.peerIds.length)
    recordStatus(status)
  }

  // Participant-only: `item:round` of a roster-triggered resend already in
  // flight (see the onFacilitatorSnapshot handler below). Snapshots can arrive faster
  // than a resend's own retry/backoff resolves, so without this a burst of
  // snapshots before the roster catches up fires one duplicate submitEstimate
  // request per snapshot instead of letting the first one finish.
  let resendInFlightKey: string | null = null

  // Facilitator only: the live-session snapshot, computed fresh on demand — both
  // as the payload of a change broadcast and as the answer to a participant's
  // `requestSnapshot` pull.
  const computeSnapshot = () => {
    const { sessionName, unit, items, activeItemId } = useSessionStore.getState()
    return buildSessionSnapshot({
      sessionName,
      unit,
      items,
      activeItemId,
      participantNames: useConnectionStore.getState().participantNames,
      connectedParticipantIds: new Set(peerParticipants.values()),
    })
  }

  // Broadcast on real changes, not on every unrelated store update (notes
  // typing, name edits, …).
  let lastSnapshotKey = ''
  const broadcastFacilitatorState = () => {
    const connection = useConnectionStore.getState()
    if (!shouldBroadcastSnapshot(connection.mode, connection.role, connection.sessionId))
      return
    const snapshot = computeSnapshot()
    const key = snapshotChangeKey(snapshot)
    if (key === lastSnapshotKey) return
    lastSnapshotKey = key
    facilitator?.sendSnapshot(snapshot)
  }

  // Trystero doesn't replay history to a newcomer, so every client (re-)broadcasts
  // its own `participantId -> display name` on connect and again whenever a peer
  // joins, letting reveal rows show real names instead of "Teammate N".
  const announceSelf = () => {
    const announcement = announcementFor(useConnectionStore.getState())
    if (announcement) live?.sendAnnounce(announcement)
  }

  // Both roles: the status line, and names for the reveal rows.
  const sharedHandlers = (session: LiveSession) => [
    session.onConnectionStateChange(syncConnectionStatus),
    session.onAnnounce((announce) =>
      useConnectionStore
        .getState()
        .applyParticipantName(announce.participantId, announce.name),
    ),
    // Every client re-announces itself whenever a peer joins, so a newcomer's
    // reveal rows show real names instead of "Teammate N" (the snapshot itself
    // is pulled by the newcomer, not pushed here).
    session.onPeerJoin(() => announceSelf()),
  ]

  // The facilitator owns the session's state: it takes the estimates, answers
  // a newcomer's snapshot request and broadcasts every real change.
  const facilitatorHandlers = (session: FacilitatorSession) => [
    session.onEstimate((itemId, estimate, _peerId, round) =>
      useRoundStore.getState().applyRemoteEstimate(itemId, estimate, round),
    ),
    session.onSnapshotRequest(() => computeSnapshot()),
    session.onAnnounce((announce, peerId) =>
      peerParticipants.set(peerId, announce.participantId),
    ),
    session.onPeerLeave((peerId) => {
      const participantId = peerParticipants.get(peerId)
      if (participantId === undefined) return
      peerParticipants.delete(peerId)
      const state = useSessionStore.getState()
      const activeItem = state.items.find((item) => item.id === state.activeItemId)
      if (
        shouldPruneDeparted(
          participantId,
          peerParticipants.values(),
          activeItem?.submissions.map((s) => s.participantId) ?? [],
        )
      ) {
        useConnectionStore.getState().removeParticipant(participantId)
      }
    }),
    useSessionStore.subscribe(broadcastFacilitatorState),
    useConnectionStore.subscribe(broadcastFacilitatorState),
  ]

  // A participant pulls the snapshot whenever its session finds the
  // facilitator (again, under a new peer), and takes the snapshots the
  // facilitator pushes. Its session hands on no one else's.
  const participantHandlers = (session: ParticipantSession) => [
    session.onFacilitatorChange((present) => {
      syncConnectionStatus(session.getConnectionState())
      if (!present) return
      withKindDrivenRetry(() => {
        if (participant !== session) return Promise.reject(new Error('No active session'))
        return session.requestSnapshot()
      })
        .then((snapshot) => {
          if (participant === session) applyFacilitatorSnapshot(snapshot)
        })
        .catch((error) => {
          console.warn('requestSnapshot pull failed after retries:', error)
        })
    }),
    session.onFacilitatorSnapshot((snapshot) => {
      applyFacilitatorSnapshot(snapshot)
      // Correctness rests on this, not on sendEstimate's ack (ADR-003,
      // "Acknowledged submissions"): on every snapshot, check whether this
      // participant's own submission actually landed, and re-send if not.
      // This is what recovers a submission that arrived but whose ack was
      // lost on the way back, as well as one that never arrived at all.
      const { participantId } = useConnectionStore.getState()
      const { liveRound } = useRoundStore.getState()
      if (!liveRound || !needsResend(liveRound, participantId)) return
      // A burst of snapshots (other participants submitting in quick
      // succession) can arrive before this participant's own roster entry
      // catches up — don't stack a second resend on top of one already
      // in flight for the same item/round.
      const resendKey = roundKey(liveRound)
      if (resendInFlightKey === resendKey) return
      resendInFlightKey = resendKey
      api
        .sendEstimate(liveRound.item.id, liveRound.mySubmission, liveRound.round)
        .catch((error) => {
          console.warn('Roster-triggered resend failed:', error)
        })
        .finally(() => {
          if (resendInFlightKey === resendKey) resendInFlightKey = null
        })
    }),
  ]

  const api: LiveSessionApi = {
    connect: (sessionId) => {
      teardown()
      const { role } = useConnectionStore.getState()
      lastRecordedStatus = null
      lastSnapshotKey = ''
      peerParticipants.clear()
      resendInFlightKey = null
      let unsubscribers: (() => void)[]
      if (role === 'participant') {
        const session = deps.joinSession.asParticipant(sessionId)
        live = participant = session
        unsubscribers = [...sharedHandlers(session), ...participantHandlers(session)]
      } else {
        const session = deps.joinSession.asFacilitator(sessionId)
        live = facilitator = session
        unsubscribers = [...sharedHandlers(session), ...facilitatorHandlers(session)]
      }
      record({ kind: 'session-start', sessionCode: sessionId, role })
      syncConnectionStatus(live.getConnectionState())
      unsubscribe = () => unsubscribers.forEach((off) => off())
      broadcastFacilitatorState()
      announceSelf()
    },
    disconnect: () => {
      teardown()
      const { setConnectionStatus, setPeerCount } = useConnectionStore.getState()
      setConnectionStatus('idle')
      setPeerCount(0)
      if (lastRecordedStatus !== null) recordStatus('idle')
    },
    sendEstimate: (itemId, estimate, round) => {
      const session = participant
      // Facilitators never submit their own estimate over the network
      // (Workspace drives that side directly).
      if (!session) return Promise.resolve()
      // The session sends to the facilitator's current peer on every attempt,
      // so a retry follows a facilitator that reconnected under a new peer,
      // and rejects as disconnected while none is known. The roster check on
      // the next snapshot, not a retry here, recovers that case.
      return withKindDrivenRetry(() => {
        if (participant !== session) return Promise.reject(new Error('No active session'))
        return session.sendEstimate(itemId, estimate, round)
      })
    },
  }

  return { api, dispose: teardown }
}
