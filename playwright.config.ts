import { defineConfig, devices } from '@playwright/test'

/** ADR-007: dual-mode signaling. Default mode connects two real browser
 *  contexts through a locally self-hosted relay (no public dependency);
 *  `PW_MODE=real-world` (nightly + manual, see
 *  .github/workflows/e2e-real-world.yml) points the same specs at the
 *  production Nostr signaling strategy instead. */
const REAL_WORLD = process.env.PW_MODE === 'real-world'

const RELAY_PORT = 8971
const APP_PORT = 4173
const RELAY_URL = `ws://localhost:${RELAY_PORT}`
const BASE_URL = `http://localhost:${APP_PORT}`

const appWebServer = REAL_WORLD
  ? {
      command: `pnpm exec vite build && pnpm exec vite preview --port ${APP_PORT} --strictPort`,
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    }
  : {
      // --mode e2e triggers vite.config.ts's alias swapping the production
      // Nostr signaling module for the ws-relay one, pointed at the relay
      // started below.
      command: `pnpm exec vite build --mode e2e && pnpm exec vite preview --mode e2e --port ${APP_PORT} --strictPort`,
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { VITE_TRYSTERO_RELAY_URL: RELAY_URL },
    }

const relayWebServer = {
  command: 'node e2e/relay-server.mjs',
  port: RELAY_PORT,
  reuseExistingServer: !process.env.CI,
  timeout: 30_000,
  env: { TRYSTERO_RELAY_PORT: String(RELAY_PORT) },
}

export default defineConfig({
  testDir: './e2e/specs',
  // Real ICE/DTLS handshakes between real browser contexts are slower and
  // more timing-variable than typical UI interactions, especially on a
  // shared CI runner — generous but bounded, per ADR-007.
  timeout: 45_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  // One shared relay/relay-backed room set per run — parallel workers would
  // contend for it. Each spec still generates its own session code.
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  webServer: REAL_WORLD ? [appWebServer] : [relayWebServer, appWebServer],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
