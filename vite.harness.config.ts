import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { version } from './vite.config.ts'

/** Serves the integration Test Level's harness page (`specs/shared/integration/harness/`).
 *  `--mode e2e` (set here) makes `src/adapters/network/session.ts` pick the local
 *  relay, exactly as the e2e build does (ADR-007). Playwright passes the port. */
export default defineConfig({
  root: fileURLToPath(new URL('./specs/shared/integration/harness', import.meta.url)),
  mode: 'e2e',
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  server: {
    // The harness imports adapters from src/, outside its own root.
    fs: { allow: [fileURLToPath(new URL('.', import.meta.url))] },
  },
})
