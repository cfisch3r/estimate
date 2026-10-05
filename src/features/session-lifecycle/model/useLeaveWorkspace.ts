import { useNavigate } from 'react-router'
import { useSessionStore } from '../../../entities/session'
import { ROUTES } from '../../../shared/lib/routes'
import { useTeardownLiveSession } from './useTeardownLiveSession'

/** Tear down the workspace entirely: the live session (if any), then the item
 *  list, then navigate to mode-select. Distinct from `useLeaveLiveSession`
 *  (participant-side leave flows), which never owns an item list to clear —
 *  this is the one place that has to know "leaving" spans all three stores
 *  (see ADR-005). */
export function useLeaveWorkspace(): () => void {
  const teardownLiveSession = useTeardownLiveSession()
  const clearSession = useSessionStore((s) => s.clearSession)
  const navigate = useNavigate()

  return () => {
    teardownLiveSession()
    clearSession()
    navigate(ROUTES.modeSelect)
  }
}
