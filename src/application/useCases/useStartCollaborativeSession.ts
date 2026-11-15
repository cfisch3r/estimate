import { useConnectionStore, useSessionStore } from '../stores'
import { useLiveSession } from './useLiveSession'
import { generateSessionCode } from './sessionCode'

/** Start a facilitator-hosted live session: generate its join code, start the
 *  session on its first pending item, and open the peer connection. Navigation is the caller's. */
export function useStartCollaborativeSession(): () => void {
  const startCollaborative = useConnectionStore((s) => s.startCollaborative)
  const startSession = useSessionStore((s) => s.startSession)
  const { connect } = useLiveSession()

  return () => {
    const sessionCode = generateSessionCode()
    startSession()
    startCollaborative(sessionCode)
    connect(sessionCode)
  }
}
