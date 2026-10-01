import { joinRoom } from '@trystero-p2p/ws-relay'
import {
  APP_ID,
  type SignalingRoom,
  type JoinSignalingRoomOptions,
} from './signalingContract'

/** Test-only signaling strategy: a locally self-hosted relay
 *  (`e2e/relay-server.mjs`) instead of public Nostr relays, so Playwright's
 *  real-WebRTC specs don't depend on third-party infrastructure. `session.ts`
 *  loads this via a guarded dynamic `import()` only when
 *  `import.meta.env.MODE === 'e2e'`; in every other build that call is dead
 *  code, so this module (and `@trystero-p2p/ws-relay`) never reaches the
 *  bundle — confirmed by bundle inspection, see ADR-007. */

// Checked at module load, not per join: this module only exists in a
// `--mode e2e` build, so a missing URL is a build misconfiguration. Failing
// at load names it immediately instead of surfacing on the first Join click.
const configuredRelayUrl = import.meta.env.VITE_TRYSTERO_RELAY_URL
if (!configuredRelayUrl) {
  throw new Error(
    'VITE_TRYSTERO_RELAY_URL must be set when building with --mode e2e (see playwright.config.ts)',
  )
}
const relayUrl: string = configuredRelayUrl

/** Same signature as `signaling.ts`'s `joinSignalingRoom` — `session.ts`
 *  programs against `signalingContract.ts`'s shape, not either concrete
 *  implementation. */
export function joinSignalingRoom(
  sessionId: string,
  options: JoinSignalingRoomOptions = {},
): SignalingRoom {
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
