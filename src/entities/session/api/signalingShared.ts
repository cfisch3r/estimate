import type { ActionRoom } from './actions'

/** Shared by both signaling strategies (`signaling.ts`'s production Nostr one
 *  and `signaling.wsRelay.ts`'s test-only one) — kept in its own module, not
 *  re-exported from `signaling.ts`, because `vite.config.ts`'s e2e-mode alias
 *  matches the literal `'./signaling'` specifier: if `signaling.wsRelay.ts`
 *  imported these from `./signaling`, that import would itself get aliased
 *  back to `signaling.wsRelay.ts`, breaking on its own missing exports. */
export const APP_ID = 'estimate-app-v1'

/** The subset of Trystero's `Room` `session.ts` needs — `ActionRoom` (the
 *  actions/messaging surface) plus the peer lifecycle hooks and `leave()`
 *  that `joinSession` wires up itself. */
export type SignalingRoom = ActionRoom & {
  onPeerJoin: ((peerId: string) => void) | null
  onPeerLeave: ((peerId: string) => void) | null
  leave: () => void
}

export interface JoinSignalingRoomOptions {
  password?: string
  onJoinError?: () => void
}
