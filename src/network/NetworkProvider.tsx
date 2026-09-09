import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { joinSession } from './session'
import type { NetworkSession } from './session'
import type { ConnectionState } from './connection'
import { NetworkSessionContext, type NetworkSessionApi } from './networkSessionContext'
import { useSessionStore } from '../state/store'

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

    // Facilitator only: keep participants' `liveRound` in sync with whichever item
    // is active and which items are finalized. Broadcast on real changes, not on
    // every unrelated store update (notes typing, name edits, …).
    let lastSnapshotKey = ''
    const broadcastFacilitatorState = () => {
      const state = useSessionStore.getState()
      if (state.mode !== 'live' || state.role !== 'facilitator' || !state.sessionId)
        return
      const active = state.items.find((item) => item.id === state.activeItemId) ?? null
      const currentItem = active
        ? { id: active.id, title: active.title, description: active.description }
        : null
      const finalizedItemIds = state.items
        .filter((item) => item.finalResult !== null)
        .map((item) => item.id)
      const key = JSON.stringify({ currentItem, unit: state.unit, finalizedItemIds })
      if (key === lastSnapshotKey) return
      lastSnapshotKey = key
      sessionRef.current?.sendSyncState({
        currentItem,
        unit: state.unit,
        submissions: [],
        finalizedItemIds,
      })
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
        const store = useSessionStore
        const unsubscribers = [
          session.onConnectionStateChange(mirror),
          session.onEstimate((estimate) =>
            store.getState().applyRemoteEstimate(estimate),
          ),
          session.onSyncState((snapshot) => store.getState().applySyncState(snapshot)),
          session.onReveal((itemId) => store.getState().applyReveal(itemId)),
          session.onAnnounce((announce) =>
            store.getState().applyParticipantName(announce.participantId, announce.name),
          ),
          store.subscribe(broadcastFacilitatorState),
          // Trystero doesn't replay history to a newcomer. When a peer joins, the
          // facilitator re-announces the current item and every client re-announces
          // its own submission — both are keyed on the receiver (item id /
          // participantId) and idempotent, so re-sending is safe.
          session.onPeerJoin(() => {
            lastSnapshotKey = ''
            broadcastFacilitatorState()
            announceSelf()
            const s = store.getState()
            const own = s.liveRound?.submissions.find(
              (e) => e.participantId === s.participantId,
            )
            if (own) sessionRef.current?.sendEstimate(own)
          }),
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
      sendEstimate: (estimate) => {
        sessionRef.current?.sendEstimate(estimate)
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
