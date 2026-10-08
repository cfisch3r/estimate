import { useConnectionStore, useSessionStore } from '../stores'
import { useNetworkSession } from '../ports/useNetworkSession'
import { generateSessionCode } from '../lib/sessionCode'

/** Start a facilitator-hosted live session: generate its join code, select the
 *  first pending item, and open the peer connection. Navigation is the caller's. */
export function useStartCollaborativeSession(): () => void {
  const startCollaborative = useConnectionStore((s) => s.startCollaborative)
  const selectFirstPending = useSessionStore((s) => s.selectFirstPending)
  const { connect } = useNetworkSession()

  return () => {
    const sessionCode = generateSessionCode()
    selectFirstPending()
    startCollaborative(sessionCode)
    connect(sessionCode)
  }
}
