import { createContext } from 'react'
import type { Estimate } from '../calc'

export interface NetworkSessionApi {
  /** Join the Trystero room for `sessionId` and mirror its connection state into the store.
   *  Safe to call again mid-session to re-join after a connection loss — it tears down
   *  the old room first, so it doubles as `reconnect`. */
  connect: (sessionId: string) => void
  /** Leave the current room (if any) and reset the store's connection fields. */
  disconnect: () => void
  /** Send this participant's validated estimate (with the item and round it's
   *  for) to the facilitator only — never broadcast to the mesh (ADR-003,
   *  "Single owner"). */
  sendEstimate: (itemId: string, estimate: Estimate, round: number) => void
}

export const NetworkSessionContext = createContext<NetworkSessionApi | null>(null)
