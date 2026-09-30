import { joinRoom } from '@trystero-p2p/ws-relay'
import {
  APP_ID,
  type SignalingRoom,
  type JoinSignalingRoomOptions,
} from './signalingShared'

/** Test-only counterpart to `signaling.ts` — never resolved in a production
 *  build. `vite.config.ts` aliases `./signaling` to this file only under
 *  `--mode e2e`, so Playwright's real-WebRTC specs connect through a locally
 *  self-hosted relay (`e2e/relay-server.mjs`) instead of public Nostr
 *  relays. See ADR-007. (Shared constants/types come from `signalingShared.ts`,
 *  not `signaling.ts` — see that file's comment for why.) */

const relayUrl = import.meta.env.VITE_TRYSTERO_RELAY_URL

/** Same signature as `signaling.ts`'s `joinSignalingRoom` — `session.ts`
 *  doesn't know or care which one it got aliased to. */
export function joinSignalingRoom(
  sessionId: string,
  options: JoinSignalingRoomOptions = {},
): SignalingRoom {
  if (!relayUrl) {
    throw new Error(
      'VITE_TRYSTERO_RELAY_URL must be set when building with --mode e2e (see e2e/relay-server.mjs)',
    )
  }
  return joinRoom(
    {
      appId: APP_ID,
      password: options.password,
      relayConfig: { urls: [relayUrl] },
    },
    sessionId,
    { onJoinError: options.onJoinError },
  ) as unknown as SignalingRoom
}
