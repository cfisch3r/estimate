import { useEffect, useState } from 'react'
import type { LiveConnectionStatus } from '../state/types'

/** What the UI should say about the connection, as opposed to what the transport
 *  is doing. `reconnecting` is a drop that Trystero is still expected to repair;
 *  `lost` is one it evidently hasn't. */
export type ConnectionPhase = 'ok' | 'reconnecting' | 'lost'

/** Trystero rebuilds a dropped link on its own: every peer re-announces to the
 *  signalling relays every ~5.3s (`announceIntervalMs`), and a peer that hears an
 *  announce from someone it isn't connected to builds a fresh connection. Most
 *  drops therefore heal in 5–10s without anyone doing anything.
 *
 *  So raising "connection lost" the instant the last peer goes cries wolf through
 *  a blip that is already fixing itself. Hold the alarm for this long first. */
export const RECONNECT_GRACE_MS = 15_000

/** Maps the raw connection status to what the user should be told, holding a
 *  disconnect at `reconnecting` until the self-healing window has passed. */
export function useConnectionPhase(status: LiveConnectionStatus): ConnectionPhase {
  const [graceElapsed, setGraceElapsed] = useState(false)

  useEffect(() => {
    if (status !== 'disconnected') {
      setGraceElapsed(false)
      return
    }
    const timer = setTimeout(() => setGraceElapsed(true), RECONNECT_GRACE_MS)
    return () => clearTimeout(timer)
  }, [status])

  if (status !== 'disconnected') return 'ok'
  return graceElapsed ? 'lost' : 'reconnecting'
}
