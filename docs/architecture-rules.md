# Architecture rules

The rules that keep the code in the layers described in [architecture.md](architecture.md),
section 5. Each rule has an ID so that scanners, the review agent, the placement skill and
reviews can cite it ("violates R5"). The words follow the [glossary](glossary.md).

In short: dependencies point inward, and only `src/app` (the composition root) touches an
adapter.

| ID | Rule | Enforced by |
|---|---|---|
| R1 | The domain imports nothing outside itself, uses no I/O globals, and only test files import `vitest`. It keeps 100% test coverage | oxlint override on `src/domain/**`, coverage threshold in `vite.config.ts` |
| R2 | The application layer imports the domain and itself. It may use React and Zustand, but no UI layer, router, transport library or adapter | oxlint override on `src/application/**` |
| R3 | Adapters import the domain, other adapters and packages other than React, Zustand and the router. From the application they import only `application/ports/outbound/**` | oxlint override on `src/adapters/**` |
| R4 | Inside the UI, imports point downward (`app`, `pages`, `widgets`, `features`, `entities`, `shared`), and a slice is reached only through its `index.ts` | Steiger (`pnpm arch`) |
| R5 | The UI folders (`pages`, `widgets`, `features`, `entities`, `shared`) never import an adapter. They import the application only through `src/application/index.ts`. The `composition` and `testing` entries are for `src/app` and test files only | oxlint overrides on the UI folders |
| R6 | Only `src/app` (the composition root) imports an adapter next to the application, creates the live-session controller and fills the contexts through which the hooks reach it. It is the one exception to R5 | R5 together with R2 |
| R7 | The UI reads store state through selectors on read-only views and may call only the trivial field setters. Every rule-bearing write goes through a use case | Type tests on the exported views (`publicStores.test.ts`), R5 |
| R8 | Store action or use case: code that reaches another store, calls a port or triggers an effect is a use case. Stores do not reach into each other, except the round store writing items through `patchItem` (ADR-005) | `architecture-review` agent |
| R9 | Ports exist only at real external boundaries (peer transport, identity and storage) and are owned by the application layer | `architecture-review` agent |
| R10 | Pure decisions live in the domain as unit-tested functions, never inline in stores, use cases, adapters or components | `architecture-review` agent, domain coverage |
| R11 | A relative `vi.mock` target must resolve, so a moved module cannot leave a stale mock | `src/viMockPaths.test.ts` |

The oxlint rules are path-based and rely on relative imports (there are no path aliases).
