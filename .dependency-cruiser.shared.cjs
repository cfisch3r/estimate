// Options shared by every dependency-cruiser config in this repo. Each config
// spreads this in and sets its own `tsConfig`.
/** @type {Partial<import('dependency-cruiser').IConfiguration['options']>} */
module.exports = {
  // Without this, type-only imports (`import type`) disappear from the graph.
  tsPreCompilationDeps: true,
  // react-router v8 is ESM-only behind an exports map. Without these conditions it
  // cannot be resolved, and the no-unresolvable-imports rule reports it.
  enhancedResolveOptions: {
    exportsFields: ['exports'],
    conditionNames: ['import', 'require', 'node', 'default', 'types'],
  },
  doNotFollow: { path: 'node_modules' },
}
