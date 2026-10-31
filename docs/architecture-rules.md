# Architecture rules

The rules that keep the code in the layers described in [architecture.md](architecture.md),
section 5. Each rule has a short name so that scanners and reviews can cite it ("violates
`ui-no-adapters`"). The architecture reviewer and the placement skill come from the
`react-webapp-architecture` plugin, whose own standard uses the same names; where estimate
departs from that standard, an `// architecture-exception:` comment at the code says so. The words follow the [glossary](glossary.md).

In short: dependencies point inward, and only `src/app` (the composition root) touches an
adapter.

| Name | Rule | Enforced by |
|---|---|---|
| `pure-domain` | The domain imports nothing outside itself, uses no I/O globals, and only test files import `vitest`. It keeps 100% test coverage | dependency-cruiser for the imports, oxlint override on `src/domain/**` for the I/O globals, coverage threshold in `vite.config.ts` |
| `app-layer-core` | The application layer imports the domain and itself. It may use React and Zustand, but no UI layer, router, transport library or adapter | dependency-cruiser |
| `adapters-inward` | Adapters import the domain, other adapters and packages other than React, Zustand and the router. From the application they import only `application/ports/outbound/**` | dependency-cruiser |
| `fsd-downward` | Inside the UI, imports point downward (`app`, `pages`, `widgets`, `features`, `entities`, `shared`), and a slice is reached only through its `index.ts` | Steiger (`pnpm arch`) |
| `ui-no-adapters` | The UI folders (`pages`, `widgets`, `features`, `entities`, `shared`) never import an adapter. They import the application only through `src/application/index.ts`. The `composition` and `testing` entries are for `src/app` and test files only | dependency-cruiser |
| `composition-root` | Only `src/app` (the composition root) imports an adapter next to the application, creates the live-session controller and fills the contexts through which the hooks reach it. It is the one exception to `ui-no-adapters` | `ui-no-adapters` together with `app-layer-core` |
| `ui-reads-views` | The UI reads store state through selectors on read-only views and may call only the trivial field setters. Every rule-bearing write goes through a use case | Type tests on the exported views (`publicStores.test.ts`), `ui-no-adapters` |
| `store-vs-usecase` | Store action or use case: code that reaches another store, calls a port or triggers an effect is a use case. Stores do not reach into each other, except the round store writing items through `patchItem` (ADR-005), marked by an exception comment in `stores/round.ts` | the plugin's architecture reviewer |
| `ports-at-boundaries` | Ports exist only at real external boundaries (peer transport, identity and storage) and are owned by the application layer | the plugin's architecture reviewer |
| `pure-decisions-in-domain` | Pure decisions live in the domain as unit-tested functions, never inline in stores, use cases, adapters or components | the plugin's architecture reviewer, domain coverage |
| `no-stale-mocks` | A relative `vi.mock` target must resolve, so a moved module cannot leave a stale mock | `src/viMockPaths.test.ts` |

The import rules live in `.dependency-cruiser.cjs`, one or more rules per rule name (each rule is named with the rule name as its prefix), and run as part of
`pnpm arch`. dependency-cruiser resolves each import to a file first, so an import it cannot
resolve would be missing from its graph. A `no-unresolvable-imports` rule reports those, and
`scripts/layerRules.test.ts` plants one violation per rule in a throwaway project to prove each
rule still fires. One more rule forbids `.tsx` files in the domain and adapters, because a file with JSX imports React implicitly and its import line never appears. oxlint keeps only the domain's I/O globals ban (`pure-domain`).
