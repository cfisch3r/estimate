import { useSessionStore } from '../state/store'
import { useNetworkSession } from '../network'

/** Tear down the current live session: drop the P2P connection, then reset the
 *  store's session state (which also routes back to the create screen). */
export function useLeaveLiveSession(): () => void {
  const leaveLiveSession = useSessionStore((s) => s.leaveLiveSession)
  const { disconnect } = useNetworkSession()

  return () => {
    disconnect()
    leaveLiveSession()
  }
}
