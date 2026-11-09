// Spike (spike/bdd-specs): decoupling rule for executable specs. A scenario's
// driver code (steps/world) lives one layer below its concept folder and may
// drive the app through Playwright, but must never reach into `src/` directly
// — that would make the spec depend on implementation internals instead of
// observable behavior. See AGENTS.md's "Picking the next task" spike brief.
const sharedOptions = require('./.dependency-cruiser.shared.cjs')

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'specs-e2e-no-src-import',
      severity: 'error',
      from: { path: '^specs/[^/]+/e2e/' },
      to: { path: '^src/' },
    },
  ],
  options: {
    ...sharedOptions,
    tsConfig: { fileName: 'tsconfig.playwright.json' },
  },
}
