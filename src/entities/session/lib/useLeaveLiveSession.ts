import { useSessionStore } from '../model/store'
import { useNetworkSession } from '../api'

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
