import { useSessionStore } from '../state/store'
import { useNetworkSession } from '../network'

/** Tear down the workspace entirely: drop the P2P connection (if any), then
 *  reset the store back to a blank mode-select. Distinct from
 *  `useLeaveLiveSession` (participant-side leave flows), which never owns an
 *  item list to clear. */
export function useLeaveWorkspace(): () => void {
  const leaveWorkspace = useSessionStore((s) => s.leaveWorkspace)
  const { disconnect } = useNetworkSession()

  return () => {
    disconnect()
    leaveWorkspace()
  }
}
