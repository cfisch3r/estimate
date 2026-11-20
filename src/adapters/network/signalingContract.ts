import type { ActionRoom } from './actions'

/** The contract both signaling strategies (`signaling.ts`'s production Nostr
 *  one and `signaling.wsRelay.ts`'s test-only one) implement — `session.ts`
 *  picks between them (see its own `import.meta.env.MODE` check) but only
 *  ever programs against this shape. */
export const APP_ID = 'estimate-app-v1'

/** The subset of Trystero's `Room` `session.ts` needs — `ActionRoom` (the
 *  actions/messaging surface) plus the peer lifecycle hooks and `leave()`
 *  that `joinSession` wires up itself. */
export type SignalingRoom = ActionRoom & {
  onPeerJoin: ((peerId: string) => void) | null
  onPeerLeave: ((peerId: string) => void) | null
  leave: () => Promise<void>
}

/** What Trystero reports when a handshake with a peer fails (its `JoinError`):
 *  the error text, and the peer it failed with, if any. */
export interface JoinErrorDetails {
  error: string
  peerId?: string
}

export interface JoinSignalingRoomOptions {
  password?: string
  onJoinError?: (details: JoinErrorDetails) => void
  /** The `RTCPeerConnection` class Trystero builds its connections from. */
  rtcPolyfill?: typeof RTCPeerConnection
}
