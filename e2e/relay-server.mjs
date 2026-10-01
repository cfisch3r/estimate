// Tiny standalone signaling relay for the local/default e2e mode (ADR-007).
// Started by playwright.config.ts as a `webServer` entry — plain JS (not TS)
// since it's infra glue run directly via `node`, not part of the app bundle.
import { createWsRelayServer } from '@trystero-p2p/ws-relay/server'

const port = Number(process.env.TRYSTERO_RELAY_PORT ?? 8971)

function fail(err) {
  const reason =
    err?.code === 'EADDRINUSE'
      ? `port ${port} is already in use (a stale relay from an earlier run?)`
      : (err?.message ?? String(err))
  console.error(`[e2e relay] failed to start: ${reason}`)
  process.exit(1)
}

const server = createWsRelayServer({ port, onError: fail })

server.ready
  .then(() => console.log(`[e2e relay] listening on ws://localhost:${port}`))
  .catch(fail)
