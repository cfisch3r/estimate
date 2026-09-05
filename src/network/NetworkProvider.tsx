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

    apiRef.current = {
      connect: (sessionId) => {
        teardown()
        const session = joinSession(sessionId)
        sessionRef.current = session
        mirror(session.getConnectionState())
        unsubscribeRef.current = session.onConnectionStateChange(mirror)
        // TODO(#7/#8): also subscribe to onEstimate / onSyncState / onReveal here
        // and dispatch them into the store.
      },
      disconnect: () => {
        teardown()
        const { setConnectionStatus, setPeerCount } = useSessionStore.getState()
        setConnectionStatus('idle')
        setPeerCount(0)
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
