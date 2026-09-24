import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { joinSession } from './session'
import type { NetworkSession } from './session'
import type { ConnectionState, ConnectionStatus } from './connection'
import type { RosterEntry } from './actions'
import { NetworkSessionContext, type NetworkSessionApi } from './networkSessionContext'
import { withKindDrivenRetry } from './retryPolicy'
import { useSessionStore } from '../state/store'
import { createEstimate } from '../calc'
import type { SessionRole } from '../state/types'

/** For a participant, the transport can report `'connected'` the instant it
 *  reaches ANY peer — including another participant, never the facilitator.
 *  Only once the facilitator's own peerId is confirmed (via its `announce`)
 *  is a participant actually "in" the session; until then this holds it at
 *  `'connecting'`, the same state used before any peer at all has joined. A
 *  facilitator's status passes through unchanged — it already means "at
 *  least one peer is here" for that role. */
function deriveConnectionStatus(
  role: SessionRole,
  trackerStatus: ConnectionStatus,
  hasFacilitatorLink: boolean,
): ConnectionStatus {
  if (role === 'participant' && trackerStatus === 'connected' && !hasFacilitatorLink) {
    return 'connecting'
  }
  return trackerStatus
}

/** The people in the round: every announced non-facilitator client, plus
 *  anyone whose submission arrived before their announce did. Values-free —
 *  this is what goes out over the wire (ADR-003, "Single owner"); the
 *  facilitator's own panel reads its local `item.submissions` for values
 *  instead. */
function buildRoster(
  participantNames: Record<string, string>,
  submittedParticipantIds: readonly string[],
  connectedParticipantIds: ReadonlySet<string>,
): RosterEntry[] {
  const submitted = new Set(submittedParticipantIds)
  const ids = [
    ...Object.keys(participantNames).filter((id) => id !== 'facilitator'),
    ...submittedParticipantIds,
  ]
  const seen = new Set<string>()
  const roster: RosterEntry[] = []
  for (const id of ids) {
    if (seen.has(id)) continue
    seen.add(id)
    roster.push({
      participantId: id,
      submitted: submitted.has(id),
      connected: connectedParticipantIds.has(id),
    })
  }
  return roster
}

/** Owns the single live NetworkSession for the app and bridges its events into the
 *  store, so screens only ever read connection state from `useSessionStore`. */
export function NetworkProvider({ children }: { children: ReactNode }) {
  const sessionRef = useRef<NetworkSession | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const apiRef = useRef<NetworkSessionApi | null>(null)

  function teardown() {
    unsubscribeRef.current?.()
    unsubscribeRef.current = null
    sessionRef.current?.leave()
    sessionRef.current = null
  }

  if (apiRef.current === null) {
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
      const { role, setConnectionStatus, setPeerCount } = useSessionStore.getState()
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
      const state = useSessionStore.getState()
      const active = state.items.find((item) => item.id === state.activeItemId) ?? null
      const currentItem = active
        ? { id: active.id, title: active.title, description: active.description }
        : null
      const finalizedItemIds = state.items
        .filter((item) => item.finalResult !== null)
        .map((item) => item.id)
      const revealed = active?.revealed ?? false
      const round = active?.round ?? 0
      // Estimate values reach participants only once revealed (ADR-003, "Single
      // owner") — pre-reveal, the roster (below) is what drives "N of M submitted".
      const submissions = revealed && active ? active.submissions : []
      const roster = buildRoster(
        state.participantNames,
        active?.submissions.map((s) => s.participantId) ?? [],
        new Set(peerParticipants.values()),
      )
      return {
        currentItem,
        sessionName: state.sessionName,
        unit: state.unit,
        revealed,
        round,
        roster,
        submissions,
        finalizedItemIds,
      }
    }

    // Broadcast on real changes, not on every unrelated store update (notes
    // typing, name edits, …).
    let lastSnapshotKey = ''
    const broadcastFacilitatorState = () => {
      const state = useSessionStore.getState()
      if (state.mode !== 'live' || state.role !== 'facilitator' || !state.sessionId)
        return
      const snapshot = computeSnapshot()
      const key = JSON.stringify({
        currentItem: snapshot.currentItem,
        sessionName: snapshot.sessionName,
        unit: snapshot.unit,
        revealed: snapshot.revealed,
        round: snapshot.round,
        roster: snapshot.roster,
        finalizedItemIds: snapshot.finalizedItemIds,
      })
      if (key === lastSnapshotKey) return
      lastSnapshotKey = key
      sessionRef.current?.sendSyncState(snapshot)
    }

    // Trystero doesn't replay history to a newcomer, so every client (re-)broadcasts
    // its own `participantId -> display name` on connect and again whenever a peer
    // joins, letting reveal rows show real names instead of "Teammate N".
    const announceSelf = () => {
      const state = useSessionStore.getState()
      if (state.mode !== 'live' || state.myName.trim().length === 0) return
      const participantId =
        state.role === 'facilitator' ? 'facilitator' : state.participantId
      if (participantId.length === 0) return
      sessionRef.current?.sendAnnounce({ participantId, name: state.myName })
    }

    apiRef.current = {
      connect: (sessionId) => {
        teardown()
        const session = joinSession(sessionId)
        sessionRef.current = session
        syncConnectionStatus(session.getConnectionState())
        lastSnapshotKey = ''
        peerParticipants.clear()
        facilitatorPeerId = null
        lastPulledFacilitatorPeerId = null
        resendInFlightKey = null
        const store = useSessionStore
        const unsubscribers = [
          session.onConnectionStateChange(syncConnectionStatus),
          session.onEstimate((itemId, estimate, _peerId, round) =>
            store.getState().applyRemoteEstimate(itemId, estimate, round),
          ),
          session.onSyncState((snapshot) => {
            store.getState().applySyncState(snapshot)
            // Correctness rests on this, not on sendEstimate's ack (ADR-003,
            // "Acknowledged submissions"): on every snapshot, check whether this
            // participant's own submission actually landed, and re-send if not.
            // This is what recovers a submission that arrived but whose ack was
            // lost on the way back, as well as one that never arrived at all.
            const state = store.getState()
            const liveRound = state.liveRound
            if (
              state.role !== 'participant' ||
              !liveRound ||
              liveRound.revealed ||
              !liveRound.mySubmission
            ) {
              return
            }
            const myEntry = liveRound.roster.find(
              (entry) => entry.participantId === state.participantId,
            )
            if (myEntry?.submitted) return
            // A burst of snapshots (other participants submitting in quick
            // succession) can arrive before this participant's own roster entry
            // catches up — don't stack a second resend on top of one already
            // in flight for the same item/round.
            const resendKey = `${liveRound.item.id}:${liveRound.round}`
            if (resendInFlightKey === resendKey) return
            const result = createEstimate({
              participantId: state.participantId,
              ...liveRound.mySubmission,
            })
            if (!result.ok) return
            resendInFlightKey = resendKey
            apiRef.current
              ?.sendEstimate(liveRound.item.id, result.value, liveRound.round)
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
            store.getState().applyParticipantName(announce.participantId, announce.name)
            // A peer that has just connected or reconnected pulls the snapshot
            // itself, rather than the facilitator inferring the event and pushing
            // one (ADR-003, "Snapshot delivery: pull on arrival"). Single fetch,
            // not polling — only re-pull if the facilitator's peerId actually
            // changed since the last pull.
            if (
              announce.participantId === 'facilitator' &&
              store.getState().role === 'participant'
            ) {
              facilitatorPeerId = peerId
              const current = sessionRef.current?.getConnectionState()
              if (current) syncConnectionStatus(current)
              if (peerId !== lastPulledFacilitatorPeerId) {
                lastPulledFacilitatorPeerId = peerId
                withKindDrivenRetry(() => {
                  const session = sessionRef.current
                  if (!session) return Promise.reject(new Error('No active session'))
                  return session.requestSnapshot(peerId)
                })
                  .then((snapshot) => store.getState().applySyncState(snapshot))
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
            if (participantId === 'facilitator') {
              facilitatorPeerId = null
              lastPulledFacilitatorPeerId = null
              const current = sessionRef.current?.getConnectionState()
              if (current) syncConnectionStatus(current)
            }
            // Roster pruning is facilitator-only: Item.submissions (the "already
            // submitted" guard below) only exists on the facilitator's copy of
            // state.items, so this guard is meaningless on a participant client.
            const state = store.getState()
            if (state.role !== 'facilitator') return
            // Two tabs in one browser share a participantId (see the JoinSession
            // warning): losing one connection must not prune a name still backed by
            // another live connection.
            const stillConnected = [...peerParticipants.values()].includes(participantId)
            if (stillConnected) return
            // A participant who already submitted keeps their estimate in the
            // aggregate (ADR-003) — pruning their name would anonymise an otherwise
            // still-attributed, already-recorded row on reveal.
            const activeItem = state.items.find((item) => item.id === state.activeItemId)
            const hasSubmitted =
              activeItem?.submissions.some((s) => s.participantId === participantId) ??
              false
            if (hasSubmitted) return
            store.getState().removeParticipant(participantId)
          }),
          store.subscribe(broadcastFacilitatorState),
          // Every client still re-announces itself whenever a peer joins, so a
          // newcomer's reveal rows show real names instead of "Teammate N" (the
          // snapshot itself is now pulled by the newcomer, not pushed here).
          session.onPeerJoin(() => announceSelf()),
        ]
        unsubscribeRef.current = () => unsubscribers.forEach((off) => off())
        broadcastFacilitatorState()
        announceSelf()
      },
      disconnect: () => {
        teardown()
        const { setConnectionStatus, setPeerCount } = useSessionStore.getState()
        setConnectionStatus('idle')
        setPeerCount(0)
      },
      sendEstimate: (itemId, estimate, round) => {
        const { role } = useSessionStore.getState()
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
          const session = sessionRef.current
          if (!session) return Promise.reject(new Error('No active session'))
          if (facilitatorPeerId === null) {
            return Promise.reject(
              Object.assign(new Error("The facilitator's peerId isn't known yet"), {
                kind: 'disconnected',
              }),
            )
          }
          return session.sendEstimate(itemId, estimate, round, facilitatorPeerId)
        })
      },
    }
  }

  useEffect(() => teardown, [])

  return (
    <NetworkSessionContext.Provider value={apiRef.current}>
      {children}
    </NetworkSessionContext.Provider>
  )
}
