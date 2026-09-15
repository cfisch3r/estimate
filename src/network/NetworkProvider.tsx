import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { joinSession } from './session'
import type { NetworkSession } from './session'
import type { ConnectionState } from './connection'
import type { RosterEntry } from './actions'
import { NetworkSessionContext, type NetworkSessionApi } from './networkSessionContext'
import { useSessionStore } from '../state/store'

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
    const mirror = (state: ConnectionState) => {
      const { setConnectionStatus, setPeerCount } = useSessionStore.getState()
      setConnectionStatus(state.status)
      setPeerCount(state.peerIds.length)
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
        mirror(session.getConnectionState())
        lastSnapshotKey = ''
        peerParticipants.clear()
        facilitatorPeerId = null
        lastPulledFacilitatorPeerId = null
        const store = useSessionStore
        const unsubscribers = [
          session.onConnectionStateChange(mirror),
          session.onEstimate((itemId, estimate, _peerId, round) =>
            store.getState().applyRemoteEstimate(itemId, estimate, round),
          ),
          session.onSyncState((snapshot) => store.getState().applySyncState(snapshot)),
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
              if (peerId !== lastPulledFacilitatorPeerId) {
                lastPulledFacilitatorPeerId = peerId
                sessionRef.current
                  ?.requestSnapshot(peerId)
                  .then((snapshot) => store.getState().applySyncState(snapshot))
                  .catch((error) => {
                    // Best-effort in #60 — no retry yet. #61 applies the shared
                    // kind-driven retry policy to this call too.
                    console.warn('requestSnapshot pull failed:', error)
                  })
              }
            }
          }),
          session.onPeerLeave((peerId) => {
            const participantId = peerParticipants.get(peerId)
            if (participantId === undefined) return
            peerParticipants.delete(peerId)
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
        if (role === 'participant') {
          // Never fall back to an untargeted broadcast: that would put this
          // estimate's values back on every other peer's wire, exactly what
          // targeting exists to prevent (ADR-003, "Single owner"). If the
          // facilitator's peerId isn't known yet (a narrow window right after
          // connect/reconnect, before its announce has arrived), drop the send
          // rather than leak it — #61's retry policy is what recovers this case.
          if (facilitatorPeerId === null) {
            console.warn(
              "Dropping sendEstimate: the facilitator's peerId isn't known yet",
            )
            return
          }
          sessionRef.current?.sendEstimate(itemId, estimate, round, facilitatorPeerId)
          return
        }
        sessionRef.current?.sendEstimate(itemId, estimate, round)
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
