import { useNavigate } from 'react-router'
import {
  useConnectionStore,
  useRoundStore,
  useNetworkSession,
} from '../../../entities/session'
import { ROUTES } from '../../../shared/lib/routes'

/** Tear down the current live session: drop the P2P connection, reset the
 *  connection and round stores, and navigate back to mode-select. */
export function useLeaveLiveSession(): () => void {
  const leaveLiveSession = useConnectionStore((s) => s.leaveLiveSession)
  const clearRound = useRoundStore((s) => s.clearRound)
  const { disconnect } = useNetworkSession()
  const navigate = useNavigate()

  return () => {
    disconnect()
    leaveLiveSession()
    clearRound()
    navigate(ROUTES.modeSelect)
  }
}
