import { joinRoom } from '@trystero-p2p/ws-relay'
import {
  APP_ID,
  type SignalingRoom,
  type JoinSignalingRoomOptions,
} from './signalingContract'

/** Test-only signaling strategy: a locally self-hosted relay
 *  (`e2e/relay-server.mjs`) instead of public Nostr relays, so Playwright's
 *  real-WebRTC specs don't depend on third-party infrastructure. `session.ts`
 *  itself only ever imports `./signaling` (the production strategy) — under
 *  `--mode e2e`, `vite.config.ts`'s `e2eSignalingSwap` plugin resolves that
 *  specific import to this file instead. Never reachable in a production
 *  build: this module (and its `@trystero-p2p/ws-relay` dependency) is
 *  simply never resolved into the module graph, confirmed by bundle
 *  inspection — see ADR-007. */

const relayUrl = import.meta.env.VITE_TRYSTERO_RELAY_URL

/** Same signature as `signaling.ts`'s `joinSignalingRoom` — `session.ts`
 *  programs against `signalingContract.ts`'s shape, not either concrete
 *  implementation. */
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
