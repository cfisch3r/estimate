/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // testHelpers.ts's defensive-throw branch is the one deliberate exception
      // to /calc's 100% coverage bar (see AGENTS.md).
      exclude: ['src/calc/testHelpers.ts'],
      thresholds: {
        'src/calc/**': { statements: 100, branches: 100, functions: 100, lines: 100 },
      },
    },
  },
})
