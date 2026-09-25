import { useLayoutEffect, useState } from 'react'

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
 *  caller decides; this only handles the timing.
 *
 *  `attemptId` lets a caller force the grace timer to restart even when `isDown`
 *  doesn't change value — e.g. a manual retry that tears down and rejoins while
 *  the status stays 'connecting' the whole time. Without it, a retry after the
 *  timer already elapsed would be stuck reporting `lost` forever. */
export function useConnectionPhase(
  isDown: boolean,
  attemptId: unknown = 0,
): ConnectionPhase {
  const [graceElapsed, setGraceElapsed] = useState(false)

  // Layout effect, not a plain effect: it must reset graceElapsed before the
  // browser paints, or a retry's stale 'lost' render (still showing the old
  // graceElapsed) would flash on screen for a frame before this fires.
  useLayoutEffect(() => {
    setGraceElapsed(false)
    if (!isDown) return
    const timer = setTimeout(() => setGraceElapsed(true), RECONNECT_GRACE_MS)
    return () => clearTimeout(timer)
  }, [isDown, attemptId])

  if (!isDown) return 'ok'
  return graceElapsed ? 'lost' : 'reconnecting'
}
