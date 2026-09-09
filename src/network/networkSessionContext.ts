import { createContext } from 'react'
import type { Estimate } from '../calc'

export interface NetworkSessionApi {
  /** Join the Trystero room for `sessionId` and mirror its connection state into the store. */
  connect: (sessionId: string) => void
  /** Leave the current room (if any) and reset the store's connection fields. */
  disconnect: () => void
  /** Broadcast this participant's validated estimate to the rest of the room. */
  sendEstimate: (estimate: Estimate) => void
}

export const NetworkSessionContext = createContext<NetworkSessionApi | null>(null)
