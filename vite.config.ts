/// <reference types="vitest/config" />
import { globSync, readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { quickpickle } from 'quickpickle'

const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8'),
) as { version: string }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  test: {
    passWithNoTests: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          // Scoped to src/ and the tooling scripts' tests so Vitest's default *.spec.ts pickup doesn't also try to
          // collect e2e/specs/*.spec.ts — those are Playwright tests, and Playwright's
          // `test()` isn't the same global Vitest provides (see ADR-007).
          include: [
            'src/**/*.{test,spec}.{ts,tsx}',
            'scripts/**/*.test.ts',
            '.claude/skills/*/scripts/**/*.test.ts',
          ],
          environment: 'jsdom',
          setupFiles: ['./src/setupTests.ts'],
        },
      },
      {
        // ADR-010's `domain` Test Level: Gherkin specs under
        // specs/<concept>/domain/, run by quickpickle against src/domain only.
        plugins: [quickpickle()],
        test: {
          name: 'specs-domain',
          include: ['specs/*/domain/*.feature'],
          environment: 'node',
          // Every concept's domain steps, so each concept's features find theirs.
          setupFiles: globSync('specs/*/domain/steps.ts').map((path) => `./${path}`),
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // testHelpers.ts's defensive-throw branch is the one deliberate exception
      // to the pure estimate core's 100% coverage bar (see AGENTS.md).
      exclude: ['src/domain/estimate/testHelpers.ts', 'src/domain/testFixtures.ts'],
      thresholds: {
        'src/domain/**': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
      },
    },
  },
})
