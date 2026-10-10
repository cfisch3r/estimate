import { useConnectionStore, useRoundStore, useSessionStore } from '../stores'
import { useLiveSession } from './useLiveSession'

/** Drop the P2P connection and reset everything a live session
 *  leaves behind outside the item list — the connection store, the
 *  participant-side round view, and the unit a participant inherited from the
 *  facilitator's snapshot. Composed here rather than inside any one store
 *  because `round.ts` reads the connection store's `role`, so the stores must
 *  not call each other (see ADR-005). */
export function useTeardownLiveSession(): () => void {
  const leaveLiveSession = useConnectionStore((s) => s.leaveLiveSession)
  const clearRound = useRoundStore((s) => s.clearRound)
  const resetUnit = useSessionStore((s) => s.resetUnit)
  const { disconnect } = useLiveSession()

  return () => {
    disconnect()
    leaveLiveSession()
    clearRound()
    resetUnit()
  }
}
