// The integration Test Level's harness page: imports the real adapters and
// installs `window.__harness`, one entry per port, for the steps' drivers
// (`../remote.ts`) to call through `page.evaluate`. Test-only; served by
// `vite.harness.config.ts`, never part of the app build.
import { downloadTextFile } from '../../../../src/adapters/file/fileDownload'
import type { Harness } from '../remote'

const harness = {
  file: { download: downloadTextFile },
} satisfies Harness

;(globalThis as unknown as { __harness: Harness }).__harness = harness
