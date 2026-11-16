import { useCallback } from 'react'
import { screenAccessFor } from '../../domain/connection'
import type { GuardedScreen } from '../../domain/connection'
import { useConnectionStore, useSessionStore } from '../stores'

/** Where a visitor of `screen` belongs right now (`screenAccessFor` over the
 *  connection and session stores' current state). Read once, at the moment a
 *  guard runs, not subscribed. */
export function currentScreenAccess(screen: GuardedScreen) {
  const { mode, role, sessionId, hasEverConnected } = useConnectionStore.getState()
  const { started } = useSessionStore.getState()
  return screenAccessFor({ mode, role, sessionId, hasEverConnected, started }, screen)
}

/** Mark the session started if it isn't yet: for a Workspace reached without
 *  either start action — a reload, the browser's Forward button, a typed
 *  address — so mode selection still sends the browser's Back button there. */
export function useMarkSessionStarted(): () => void {
  const startSession = useSessionStore((s) => s.startSession)
  return useCallback(() => {
    if (!useSessionStore.getState().started) startSession()
  }, [startSession])
}
