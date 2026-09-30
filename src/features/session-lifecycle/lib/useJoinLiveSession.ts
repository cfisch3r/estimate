import { useConnectionStore, useRoundStore } from '../../../entities/session'

/** Join a live session as a participant. Composes `connection.ts`'s
 *  `joinLiveSession` with clearing any stale round view left over from a
 *  previous session — kept out of `connection.ts` itself since `round.ts`
 *  already reads that store's `role`, and the reverse call would create a
 *  store import cycle (see ADR-005). */
export function useJoinLiveSession(): (sessionCode: string, name: string) => void {
  const joinLiveSession = useConnectionStore((s) => s.joinLiveSession)
  const clearRound = useRoundStore((s) => s.clearRound)

  return (sessionCode, name) => {
    if (joinLiveSession(sessionCode, name)) clearRound()
  }
}
