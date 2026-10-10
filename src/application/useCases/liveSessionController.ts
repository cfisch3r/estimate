import {
  announcementFor,
  deriveConnectionStatus,
  shouldBroadcastSnapshot,
} from '../../domain/connection'
import { FACILITATOR_PARTICIPANT_ID } from '../../domain/participantId'
import { needsResend, roundKey } from '../../domain/resend'
import { shouldPruneDeparted } from '../../domain/roster'
import { buildSessionSnapshot, snapshotChangeKey } from '../../domain/snapshot'
import type { LiveSessionApi } from './liveSessionContext'
import type {
  ConnectionState,
  JoinSession,
  TransportSession,
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
}): LiveSessionController {
  let live: TransportSession | null = null
  let unsubscribe: (() => void) | null = null

  function teardown() {
    unsubscribe?.()
    unsubscribe = null
    live?.leave()
    live = null
  }

  // Trystero's onPeerLeave gives a peerId (a connection), not a participantId (a
  // person) — this map, built from inbound announces, is what lets a departure be
  // resolved back to the participant who left, and lets the roster report who's
  // currently connected.
  const peerParticipants = new Map<string, string>()

  // Participant-only: the facilitator's peerId, learned from its `announce`.
  // Targets `sendEstimate` at it and dedupes the pull-on-connect below so a
  // re-announce triggered by an unrelated peer join doesn't re-pull.
  let facilitatorPeerId: string | null = null
  let lastPulledFacilitatorPeerId: string | null = null

  // Writes connectionStatus/peerCount into the store from the transport's raw
  // state, gated through deriveConnectionStatus so a participant isn't told
  // it's connected before facilitatorPeerId (above) is known.
  const syncConnectionStatus = (trackerState: ConnectionState) => {
    const { role, setConnectionStatus, setPeerCount } = useConnectionStore.getState()
    setConnectionStatus(
      deriveConnectionStatus(role, trackerState.status, facilitatorPeerId !== null),
    )
    setPeerCount(trackerState.peerIds.length)
  }

  // Participant-only: `item:round` of a roster-triggered resend already in
  // flight (see the onSyncState handler below). Snapshots can arrive faster
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
    live?.sendSyncState(snapshot)
  }

  // Trystero doesn't replay history to a newcomer, so every client (re-)broadcasts
  // its own `participantId -> display name` on connect and again whenever a peer
  // joins, letting reveal rows show real names instead of "Teammate N".
  const announceSelf = () => {
    const announcement = announcementFor(useConnectionStore.getState())
    if (announcement) live?.sendAnnounce(announcement)
  }

  const api: LiveSessionApi = {
    connect: (sessionId) => {
      teardown()
      const session = deps.joinSession(sessionId)
      live = session
      syncConnectionStatus(session.getConnectionState())
      lastSnapshotKey = ''
      peerParticipants.clear()
      facilitatorPeerId = null
      lastPulledFacilitatorPeerId = null
      resendInFlightKey = null
      const unsubscribers = [
        session.onConnectionStateChange(syncConnectionStatus),
        session.onEstimate((itemId, estimate, _peerId, round) =>
          useRoundStore.getState().applyRemoteEstimate(itemId, estimate, round),
        ),
        session.onSyncState((snapshot) => {
          applyFacilitatorSnapshot(snapshot)
          // Correctness rests on this, not on sendEstimate's ack (ADR-003,
          // "Acknowledged submissions"): on every snapshot, check whether this
          // participant's own submission actually landed, and re-send if not.
          // This is what recovers a submission that arrived but whose ack was
          // lost on the way back, as well as one that never arrived at all.
          const { role, participantId } = useConnectionStore.getState()
          const { liveRound } = useRoundStore.getState()
          if (
            role !== 'participant' ||
            !liveRound ||
            !needsResend(liveRound, participantId)
          ) {
            return
          }
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
        session.onRequestSnapshot(() => computeSnapshot()),
        session.onAnnounce((announce, peerId) => {
          peerParticipants.set(peerId, announce.participantId)
          useConnectionStore
            .getState()
            .applyParticipantName(announce.participantId, announce.name)
          // A peer that has just connected or reconnected pulls the snapshot
          // itself, rather than the facilitator inferring the event and pushing
          // one (ADR-003, "Snapshot delivery: pull on arrival"). Single fetch,
          // not polling — only re-pull if the facilitator's peerId actually
          // changed since the last pull.
          if (
            announce.participantId === FACILITATOR_PARTICIPANT_ID &&
            useConnectionStore.getState().role === 'participant'
          ) {
            facilitatorPeerId = peerId
            const current = live?.getConnectionState()
            if (current) syncConnectionStatus(current)
            if (peerId !== lastPulledFacilitatorPeerId) {
              lastPulledFacilitatorPeerId = peerId
              withKindDrivenRetry(() => {
                const active = live
                if (!active) return Promise.reject(new Error('No active session'))
                return active.requestSnapshot(peerId)
              })
                .then((snapshot) => applyFacilitatorSnapshot(snapshot))
                .catch((error) => {
                  console.warn('requestSnapshot pull failed after retries:', error)
                })
            }
          }
        }),
        session.onPeerLeave((peerId) => {
          const participantId = peerParticipants.get(peerId)
          if (participantId === undefined) return
          peerParticipants.delete(peerId)
          // Losing the facilitator's own peer means the confirmed link is gone,
          // even if other participants' connections remain up. Re-derive right
          // away — connection.ts's handlePeerLeave fires notifyStateChange (which
          // drives syncConnectionStatus above) BEFORE its peerLeaveListeners
          // (this handler), so without this the tracker-driven sync would already
          // have run with a stale, not-yet-cleared facilitatorPeerId. Clearing
          // lastPulledFacilitatorPeerId too lets a facilitator reconnect under a
          // new peerId re-trigger the snapshot pull instead of being deduped.
          if (participantId === FACILITATOR_PARTICIPANT_ID) {
            facilitatorPeerId = null
            lastPulledFacilitatorPeerId = null
            const current = live?.getConnectionState()
            if (current) syncConnectionStatus(current)
          }
          // Roster pruning is facilitator-only: Item.submissions (the "already
          // submitted" guard below) only exists on the facilitator's copy of
          // state.items, so this guard is meaningless on a participant client.
          if (useConnectionStore.getState().role !== 'facilitator') return
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
        // Every client still re-announces itself whenever a peer joins, so a
        // newcomer's reveal rows show real names instead of "Teammate N" (the
        // snapshot itself is now pulled by the newcomer, not pushed here).
        session.onPeerJoin(() => announceSelf()),
      ]
      unsubscribe = () => unsubscribers.forEach((off) => off())
      broadcastFacilitatorState()
      announceSelf()
    },
    disconnect: () => {
      teardown()
      const { setConnectionStatus, setPeerCount } = useConnectionStore.getState()
      setConnectionStatus('idle')
      setPeerCount(0)
    },
    sendEstimate: (itemId, estimate, round) => {
      const { role } = useConnectionStore.getState()
      // Facilitator-only clients never submit their own estimate over the
      // network (Workspace drives that side directly), so this is
      // participant-only in practice.
      if (role !== 'participant') return Promise.resolve()
      // Never fall back to an untargeted broadcast: that would put this
      // estimate's values back on every other peer's wire, exactly what
      // targeting exists to prevent (ADR-003, "Single owner"). If the
      // facilitator's peerId isn't known yet (a narrow window right after
      // connect/reconnect, before its announce has arrived), reject the same
      // way an actually-dead link would — the roster convergence check (in
      // onSyncState above), not a retry here, is what recovers this case
      // once the peerId is learned.
      if (facilitatorPeerId === null) {
        return Promise.reject(
          Object.assign(new Error("The facilitator's peerId isn't known yet"), {
            kind: 'disconnected',
          }),
        )
      }
      // Re-read facilitatorPeerId on every attempt, not just the first: a
      // retry can span several seconds, long enough for the facilitator to
      // reconnect and re-announce under a new peerId mid-retry. Capturing
      // the old one up front would keep every retry aimed at a connection
      // that's already gone.
      return withKindDrivenRetry(() => {
        const active = live
        if (!active) return Promise.reject(new Error('No active session'))
        if (facilitatorPeerId === null) {
          return Promise.reject(
            Object.assign(new Error("The facilitator's peerId isn't known yet"), {
              kind: 'disconnected',
            }),
          )
        }
        return active.sendEstimate(itemId, estimate, round, facilitatorPeerId)
      })
    },
  }

  return { api, dispose: teardown }
}
