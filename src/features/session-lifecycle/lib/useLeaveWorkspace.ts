import { useNavigate } from 'react-router'
import {
  useSessionStore,
  useConnectionStore,
  useRoundStore,
  useNetworkSession,
} from '../../../entities/session'
import { ROUTES } from '../../../shared/lib/routes'

/** Tear down the workspace entirely: drop the P2P connection (if any), reset
 *  all three session stores back to a blank slate, and navigate to
 *  mode-select. Distinct from `useLeaveLiveSession` (participant-side leave
 *  flows), which never owns an item list to clear — this is the one place
 *  that has to know "leaving" spans all three stores (see ADR-005). */
export function useLeaveWorkspace(): () => void {
  const clearSession = useSessionStore((s) => s.clearSession)
  const leaveLiveSession = useConnectionStore((s) => s.leaveLiveSession)
  const clearRound = useRoundStore((s) => s.clearRound)
  const { disconnect } = useNetworkSession()
  const navigate = useNavigate()

  return () => {
    disconnect()
    leaveLiveSession()
    clearRound()
    clearSession()
    navigate(ROUTES.modeSelect)
  }
}
