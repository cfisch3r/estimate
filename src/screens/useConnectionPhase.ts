import { useEffect, useState } from 'react'

/** What the UI should say about the connection, as opposed to what the transport
 *  is doing. `reconnecting` is a drop Trystero is still expected to repair;
 *  `lost` is one it evidently hasn't. */
export type ConnectionPhase = 'ok' | 'reconnecting' | 'lost'

/** Trystero rebuilds a dropped link on its own: every peer re-announces to the
 *  signalling relays every ~5.3s (`announceIntervalMs`), and a peer that hears an
 *  announce from someone it isn't connected to builds a fresh connection. Most
 *  drops therefore heal in 5–10s without anyone doing anything.
 *
 *  So raising "connection lost" the instant a link goes cries wolf through a blip
 *  that is already fixing itself. Hold the alarm for this long first. */
export const RECONNECT_GRACE_MS = 15_000

/** Holds a dropped connection at `reconnecting` until the self-healing window has
 *  passed, then escalates to `lost`.
 *
 *  Takes a plain boolean rather than a `connectionStatus` because what counts as
 *  "down" differs by role: a participant is down when it has lost the session it
 *  was in, while a facilitator alone is merely waiting for people to arrive. The
 *  caller decides; this only handles the timing. */
export function useConnectionPhase(isDown: boolean): ConnectionPhase {
  const [graceElapsed, setGraceElapsed] = useState(false)

  useEffect(() => {
    if (!isDown) {
      setGraceElapsed(false)
      return
    }
    const timer = setTimeout(() => setGraceElapsed(true), RECONNECT_GRACE_MS)
    return () => clearTimeout(timer)
  }, [isDown])

  if (!isDown) return 'ok'
  return graceElapsed ? 'lost' : 'reconnecting'
}
