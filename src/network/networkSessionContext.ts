import { createContext } from 'react'

export interface NetworkSessionApi {
  /** Join the Trystero room for `sessionId` and mirror its connection state into the store. */
  connect: (sessionId: string) => void
  /** Leave the current room (if any) and reset the store's connection fields. */
  disconnect: () => void
}

export const NetworkSessionContext = createContext<NetworkSessionApi | null>(null)
