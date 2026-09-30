/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8'),
) as { version: string }

const wsRelaySignalingPath = fileURLToPath(
  new URL('./src/entities/session/api/signaling.wsRelay', import.meta.url),
)

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    // Only the e2e build (`vite build --mode e2e`, driven by playwright.config.ts)
    // swaps the production Nostr signaling module for the self-hosted ws-relay one
    // — a production build never resolves signaling.wsRelay.ts at all. See ADR-007.
    // Vite/Rollup aliases match the literal import specifier text (not a resolved
    // path), so this only fires for `session.ts`'s exact `from './signaling'` —
    // currently the only place that specifier appears in the codebase.
    alias:
      mode === 'e2e' ? [{ find: './signaling', replacement: wsRelaySignalingPath }] : [],
  },
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  test: {
    // Scoped to src/ so Vitest's default *.spec.ts pickup doesn't also try to
    // collect e2e/specs/*.spec.ts — those are Playwright tests, and Playwright's
    // `test()` isn't the same global Vitest provides (see ADR-007).
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // testHelpers.ts's defensive-throw branch is the one deliberate exception
      // to entities/estimate's 100% coverage bar (see AGENTS.md).
      exclude: ['src/entities/estimate/model/testHelpers.ts'],
      thresholds: {
        'src/entities/estimate/model/**': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
      },
    },
  },
}))
