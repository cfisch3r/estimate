// Spike (spike/bdd-specs): decoupling rule for executable specs. A scenario's
// driver code (steps/world) lives one layer below its concept folder and may
// drive the app through Playwright, but must never reach into `src/` directly
// — that would make the spec depend on implementation internals instead of
// observable behavior. See AGENTS.md's "Picking the next task" spike brief.
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
    tsConfig: { fileName: 'tsconfig.playwright.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
    },
    doNotFollow: { path: 'node_modules' },
  },
}
