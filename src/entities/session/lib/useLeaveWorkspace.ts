import { useNavigate } from 'react-router'
import { useSessionStore } from '../model/store'
import { useNetworkSession } from '../api'

/** Tear down the workspace entirely: drop the P2P connection (if any), reset
 *  the store back to a blank slate, and navigate to mode-select. Distinct from
 *  `useLeaveLiveSession` (participant-side leave flows), which never owns an
 *  item list to clear. */
export function useLeaveWorkspace(): () => void {
  const leaveWorkspace = useSessionStore((s) => s.leaveWorkspace)
  const { disconnect } = useNetworkSession()
  const navigate = useNavigate()

  return () => {
    disconnect()
    leaveWorkspace()
    navigate('/')
  }
}
