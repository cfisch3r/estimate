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
    {
      // Concept-level test data (stereotypes) is shared by a concept's Test
      // Levels, so it may import nothing from src/ either (ADR-010).
      name: 'specs-concept-no-src-import',
      severity: 'error',
      from: { path: '^specs/[^/]+/[^/]+\\.ts$' },
      to: { path: '^src/' },
    },
    {
      // A `domain` Test Level driver calls the pure domain directly, and
      // nothing else in src/ — no stores, adapters or UI (ADR-010).
      name: 'specs-domain-only-domain-import',
      severity: 'error',
      from: { path: '^specs/[^/]+/domain/' },
      to: { path: '^src/', pathNot: '^src/domain/' },
    },
    {
      // The `integration` Test Level's harness page runs the real adapters, so
      // it may import them, the ports they implement and the domain types they
      // carry, but nothing that would let a scenario bypass the port (ADR-011).
      name: 'specs-integration-harness-imports-adapters-ports-domain',
      severity: 'error',
      from: { path: '^specs/shared/integration/harness/' },
      to: { path: '^src/', pathNot: '^src/(adapters|application/ports|domain)/' },
    },
    {
      // Integration steps, drivers and the world fixture run in Node and reach
      // the adapters only through the harness page; from src/ they take types
      // only, such as the port types their drivers are derived from (ADR-011).
      name: 'specs-integration-type-only-src',
      severity: 'error',
      from: {
        path: '^specs/[^/]+/integration/',
        pathNot: '^specs/shared/integration/harness/',
      },
      to: { path: '^src/', dependencyTypesNot: ['type-only'] },
    },
  ],
  options: {
    ...sharedOptions,
    tsConfig: { fileName: 'tsconfig.playwright.json' },
  },
}
