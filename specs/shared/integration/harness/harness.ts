// The integration Test Level's harness page: imports the real adapters and
// installs `window.__harness`, one entry per port, for the steps' drivers
// (`../remote.ts`) to call through `page.evaluate`. Test-only; served by
// `vite.harness.config.ts`, never part of the app build.
import { downloadTextFile } from '../../../../src/adapters/file/fileDownload'
import type { Harness } from '../remote'

// Spec first (#229): the `diagnostics` and `network` entries arrive with their
// adapters, and this goes back to `satisfies Harness` then. Until they do, their
// scenarios fail with "window.__harness.… is not installed".
const harness = {
  file: { download: downloadTextFile },
} satisfies Pick<Harness, 'file'>

;(globalThis as unknown as { __harness: Partial<Harness> }).__harness = harness
