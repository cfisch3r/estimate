import { useNavigate } from 'react-router'
import { useConnectionStore, useSessionStore } from '../../../entities/session'
import { ROUTES } from '../../../shared/lib/routes'
import { useTeardownLiveSession } from './useTeardownLiveSession'

/** Tear down the workspace entirely: the live session (if any), then the item
 *  list, then navigate to mode-select. Distinct from `useLeaveLiveSession`
 *  (participant-side leave flows), which never owns an item list to clear —
 *  this is the one place that has to know "leaving" spans all three stores
 *  (see ADR-005). */
export function useLeaveWorkspace(): {
  leaveWorkspace: () => void
  /** Leaving a live session that still has peers is destructive for them too,
   *  so the caller should ask for a second click first. */
  needsConfirm: boolean
} {
  const mode = useConnectionStore((s) => s.mode)
  const peerCount = useConnectionStore((s) => s.peerCount)
  const teardownLiveSession = useTeardownLiveSession()
  const clearSession = useSessionStore((s) => s.clearSession)
  const navigate = useNavigate()

  return {
    leaveWorkspace: () => {
      teardownLiveSession()
      clearSession()
      navigate(ROUTES.modeSelect)
    },
    needsConfirm: mode === 'live' && peerCount > 0,
  }
}
