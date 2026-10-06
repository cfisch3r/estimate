import {
  useConnectionStore,
  useNetworkSession,
  useRoundStore,
} from '../../../entities/session'

/** Join a live session as a participant: normalise the code, record the join in
 *  `connection.ts`, clear any stale round view left over from a previous session,
 *  and open the peer connection. The round is cleared here rather than in
 *  `connection.ts` itself since `round.ts` already reads that store's `role`, and
 *  the reverse call would create a store import cycle (see ADR-005). */
export function useJoinLiveSession(): (sessionCode: string, name: string) => void {
  const joinLiveSession = useConnectionStore((s) => s.joinLiveSession)
  const clearRound = useRoundStore((s) => s.clearRound)
  const { connect } = useNetworkSession()

  return (sessionCode, name) => {
    const code = sessionCode.trim().toUpperCase()
    if (joinLiveSession(code, name)) {
      clearRound()
      connect(code)
    }
  }
}
