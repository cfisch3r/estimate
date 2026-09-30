// Tiny standalone signaling relay for the local/default e2e mode (ADR-007).
// Started by playwright.config.ts as a `webServer` entry — plain JS (not TS)
// since it's infra glue run directly via `node`, not part of the app bundle.
import { createWsRelayServer } from '@trystero-p2p/ws-relay/server'

const port = Number(process.env.TRYSTERO_RELAY_PORT ?? 8971)
const server = createWsRelayServer({ port })

server.ready.then(() => {
  console.log(`[e2e relay] listening on ws://localhost:${port}`)
})
