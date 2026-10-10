import { useConnectionStore } from '../stores'
import { useLiveSession } from './useLiveSession'

/** Re-open the peer connection to the current session after it dropped or a
 *  join failed. `canReconnect` is false when there is no session to rejoin. */
export function useReconnect(): { reconnect: () => void; canReconnect: boolean } {
  const sessionId = useConnectionStore((s) => s.sessionId)
  const { connect } = useLiveSession()

  return {
    reconnect: () => {
      if (sessionId) connect(sessionId)
    },
    canReconnect: Boolean(sessionId),
  }
}
