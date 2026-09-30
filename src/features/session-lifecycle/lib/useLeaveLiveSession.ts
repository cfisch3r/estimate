import { useNavigate } from 'react-router'
import { useSessionStore, useNetworkSession } from '../../../entities/session'
import { ROUTES } from '../../../shared/lib/routes'

/** Tear down the current live session: drop the P2P connection, reset the
 *  store's session state, and navigate back to mode-select. */
export function useLeaveLiveSession(): () => void {
  const leaveLiveSession = useSessionStore((s) => s.leaveLiveSession)
  const { disconnect } = useNetworkSession()
  const navigate = useNavigate()

  return () => {
    disconnect()
    leaveLiveSession()
    navigate(ROUTES.modeSelect)
  }
}
