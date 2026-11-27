// The integration Test Level's harness page: imports the real adapters and
// installs `window.__harness`, one entry per port, for the steps' drivers
// (`../remote.ts`) to call through `page.evaluate`. Test-only; served by
// `vite.harness.config.ts`, never part of the app build.
import { downloadTextFile } from '../../../../src/adapters/file/fileDownload'
import { sessionFiles } from '../../../../src/adapters/file/sessionFiles'
import { createJoinSession } from '../../../../src/adapters/network/session'
import { createDiagnosticsLog } from '../../../../src/adapters/storage/diagnosticsLog'
import { getOrCreateParticipantId } from '../../../../src/adapters/storage/participantIdentity'
import type { Harness } from '../remote'

// Composed as `App.tsx` composes them: one log per page, which the network
// adapter records into.
const diagnostics = createDiagnosticsLog()

const harness = {
  file: { download: downloadTextFile },
  sessionFiles,
  diagnostics,
  participantIdentity: { getOrCreateParticipantId },
  network: createJoinSession({ diagnostics }),
} satisfies Harness

;(globalThis as unknown as { __harness: Harness }).__harness = harness
