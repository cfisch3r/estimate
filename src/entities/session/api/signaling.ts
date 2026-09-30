import { joinRoom } from 'trystero/nostr'
import {
  APP_ID,
  type SignalingRoom,
  type JoinSignalingRoomOptions,
} from './signalingShared'

export type { SignalingRoom, JoinSignalingRoomOptions }

/** Joins the Trystero room for a session using the production signaling
 *  strategy (Nostr relays, per ADR-001/docs/architecture.md). A test-only
 *  build (`vite --mode e2e`) aliases this module to `signaling.wsRelay.ts`
 *  instead — see ADR-007. */
export function joinSignalingRoom(
  sessionId: string,
  options: JoinSignalingRoomOptions = {},
): SignalingRoom {
  return joinRoom({ appId: APP_ID, password: options.password }, sessionId, {
    onJoinError: options.onJoinError,
  }) as unknown as SignalingRoom
}
