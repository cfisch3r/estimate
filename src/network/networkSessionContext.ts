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
   *  "Single owner"). Applies the shared kind-driven retry policy internally;
   *  the returned promise rejects only once retries are exhausted (or the
   *  failure kind isn't retryable), so callers use it purely to drive
   *  delivery-status UI, not to decide whether to retry themselves. */
  sendEstimate: (itemId: string, estimate: Estimate, round: number) => Promise<void>
}

export const NetworkSessionContext = createContext<NetworkSessionApi | null>(null)
