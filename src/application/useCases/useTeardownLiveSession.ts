import { useConnectionStore, useRoundStore, useSessionStore } from '../stores'
import { useLiveSession } from './useLiveSession'

/** Drop the P2P connection, if any, and reset all three stores back to a new
 *  session: the connection store, the participant-side round view, and the
 *  session itself (a participant's name and unit come from the facilitator's
 *  snapshot and must not leak into the next session). Composed here rather
 *  than inside any one store because `round.ts` reads the connection store's
 *  `role`, so the stores must not call each other (see ADR-005). */
export function useTeardownLiveSession(): () => void {
  const leaveLiveSession = useConnectionStore((s) => s.leaveLiveSession)
  const clearRound = useRoundStore((s) => s.clearRound)
  const resetSession = useSessionStore((s) => s.resetSession)
  const { disconnect } = useLiveSession()

  return () => {
    disconnect()
    leaveLiveSession()
    clearRound()
    resetSession()
  }
}
