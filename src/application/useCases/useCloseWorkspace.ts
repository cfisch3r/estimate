import { leavingNeedsConfirm } from '../../domain/connection'
import { useConnectionStore, useSessionStore } from '../stores'
import { useTeardownLiveSession } from './useTeardownLiveSession'

/** Tear down the workspace entirely: the live session (if any), then the item
 *  list. This is the one place that has to know "leaving" spans all three stores
 *  (see ADR-005). Navigation is the caller's. */
export function useCloseWorkspace(): {
  closeWorkspace: () => void
  /** Leaving a live session that still has peers is destructive for them too,
   *  so the caller should ask for a second click first. */
  needsConfirm: boolean
} {
  const mode = useConnectionStore((s) => s.mode)
  const peerCount = useConnectionStore((s) => s.peerCount)
  const teardownLiveSession = useTeardownLiveSession()
  const clearSession = useSessionStore((s) => s.clearSession)

  return {
    closeWorkspace: () => {
      teardownLiveSession()
      clearSession()
    },
    needsConfirm: leavingNeedsConfirm(mode, peerCount),
  }
}
