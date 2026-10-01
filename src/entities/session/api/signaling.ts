import { joinRoom } from 'trystero/nostr'
import {
  APP_ID,
  type SignalingRoom,
  type JoinSignalingRoomOptions,
} from './signalingContract'

export type { SignalingRoom, JoinSignalingRoomOptions }

/** Production signaling strategy: Nostr relays, per ADR-001/docs/architecture.md.
 *  `session.ts` picks between this and `signaling.wsRelay.ts` (test-only) by
 *  `import.meta.env.MODE` — see ADR-007. */
export function joinSignalingRoom(
  sessionId: string,
  options: JoinSignalingRoomOptions = {},
): SignalingRoom {
  return joinRoom({ appId: APP_ID, password: options.password }, sessionId, {
    onJoinError: options.onJoinError,
  }) as unknown as SignalingRoom
}
