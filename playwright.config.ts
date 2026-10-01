import { defineConfig, devices } from '@playwright/test'

/** ADR-007: dual-mode signaling. Default mode connects real browser contexts
 *  through a locally self-hosted relay (no public dependency);
 *  `PW_MODE=real-world` (nightly + manual, see
 *  .github/workflows/e2e-real-world.yml) points the same specs at the
 *  production Nostr signaling strategy instead. */
const REAL_WORLD = process.env.PW_MODE === 'real-world'

const RELAY_PORT = 8971
// Distinct per mode: with `reuseExistingServer` on locally, a shared port
// would let one mode silently reuse the other mode's still-running build.
const APP_PORT = REAL_WORLD ? 4174 : 4173
const RELAY_URL = `ws://localhost:${RELAY_PORT}`
const BASE_URL = `http://localhost:${APP_PORT}`

const webServerDefaults = {
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
}

const appWebServer = {
  ...webServerDefaults,
  url: BASE_URL,
  ...(REAL_WORLD
    ? {
        command: `pnpm exec vite build && pnpm exec vite preview --port ${APP_PORT} --strictPort`,
      }
    : {
        // --mode e2e only matters for the build: it makes
        // `import.meta.env.MODE === 'e2e'` in session.ts, which selects the
        // ws-relay signaling strategy, pointed at the relay below. `preview`
        // just serves the finished bundle, so it needs no mode.
        command: `pnpm exec vite build --mode e2e && pnpm exec vite preview --port ${APP_PORT} --strictPort`,
        env: { VITE_TRYSTERO_RELAY_URL: RELAY_URL },
      }),
}

const relayWebServer = {
  ...webServerDefaults,
  command: 'node e2e/relay-server.mjs',
  port: RELAY_PORT,
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
  // Specs are independent: each generates its own session code, so its Trystero
  // room is disjoint from every other spec's on the shared relay.
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  webServer: REAL_WORLD ? [appWebServer] : [relayWebServer, appWebServer],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
