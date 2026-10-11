// The import half of R1, and R2, R3 and R5 from docs/architecture-rules.md as
// dependency-cruiser rules. R4 stays with Steiger, the I/O globals ban and coverage of R1 with
// oxlint and vitest.
const UI = '^src/(pages|widgets|features|entities|shared)/'
const TEST = '\\.test\\.tsx?$'
// Domain files that may import vitest (R1): tests and their helpers.
const DOMAIN_TEST_SUPPORT = [
  '^src/domain/.*\\.test\\.tsx?$',
  '^src/domain/testFixtures\\.ts$',
  '^src/domain/estimate/testHelpers\\.ts$',
]

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      // Guards the rules below: an import that cannot be resolved is not in the
      // graph, so no layer rule could ever fire on it.
      name: 'no-unresolvable-imports',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: 'R1-domain-imports-nothing-outside-itself',
      severity: 'error',
      from: { path: '^src/domain/', pathNot: DOMAIN_TEST_SUPPORT },
      to: { pathNot: '^src/domain/' },
    },
    {
      name: 'R1-domain-tests-import-only-domain-and-vitest',
      severity: 'error',
      from: { path: DOMAIN_TEST_SUPPORT },
      to: { pathNot: ['^src/domain/', 'node_modules/vitest/'] },
    },
    {
      name: 'R2-application-no-ui-no-adapter',
      severity: 'error',
      from: { path: '^src/application/' },
      to: { path: '^src/(pages|widgets|features|entities|shared|app|adapters)/' },
    },
    {
      name: 'R2-application-no-router-or-transport',
      severity: 'error',
      from: { path: '^src/application/' },
      to: {
        path: 'node_modules/(react-router|react-router-dom|trystero|@trystero-p2p)/',
      },
    },
    {
      name: 'R3-adapters-no-ui-no-framework',
      severity: 'error',
      from: { path: '^src/adapters/' },
      to: {
        path: [
          '^src/(pages|widgets|features|entities|shared|app)/',
          'node_modules/(react|react-dom|zustand|react-router)/',
        ],
      },
    },
    {
      name: 'R3-adapters-application-only-outbound-ports',
      severity: 'error',
      from: { path: '^src/adapters/' },
      to: { path: '^src/application/', pathNot: '^src/application/ports/outbound/' },
    },
    {
      name: 'R5-ui-no-adapter',
      severity: 'error',
      from: { path: UI },
      to: { path: '^src/adapters/' },
    },
    {
      name: 'R5-ui-application-only-through-barrel',
      severity: 'error',
      from: { path: UI },
      to: { path: '^src/application/(stores|ports|useCases)(/|\\.|$)' },
    },
    {
      name: 'R5-composition-entry-only-in-app-and-tests',
      severity: 'error',
      from: { path: UI, pathNot: TEST },
      to: { path: '^src/application/composition(/|\\.|$)' },
    },
    {
      name: 'R5-testing-entry-only-in-tests',
      severity: 'error',
      from: { path: '^src/(pages|widgets|features|entities|shared|app)/', pathNot: TEST },
      to: { path: '^src/application/testing(/|\\.|$)' },
    },
    {
      name: 'R5-app-application-only-through-barrel',
      severity: 'error',
      from: { path: '^src/app/' },
      to: { path: '^src/application/(stores|ports|useCases)(/|\\.|$)' },
    },
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.app.json' },
    // Without this, type-only imports (`import type`) disappear from the graph.
    tsPreCompilationDeps: true,
    // react-router v8 is ESM-only behind an exports map. Without these conditions it
    // cannot be resolved, and the no-unresolvable-imports rule reports it.
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
    },
    doNotFollow: { path: 'node_modules' },
  },
}
