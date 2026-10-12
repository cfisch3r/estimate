---
name: code-placement
description: Where code belongs in this repo — first the architecture layer (domain, application, adapters, UI), then for UI code the Feature-Sliced Design layer and slice, the import-direction rule, and the public-API rule. Use before creating a new file under src/, moving code between layers or slices, or adding a new feature/entity (e.g. Story Point Estimation, Roadmap Building).
---

# Where code belongs in this repo

## First: which layer?

The architecture is a hexagonal core plus an FSD UI (`docs/adr/009-architecture-style-fsd-vs-hexagonal-core.md`;
vocabulary in `docs/glossary.md`). Dependencies point inward. Ask in this order; the first
yes wins:

| Question | Home |
|---|---|
| Is it a pure rule or type (no React, no I/O, no globals) that decides something? | `src/domain` (100% test coverage; imports nothing outside itself) |
| Is it talking to the outside world (peer transport, wire parsing, storage)? | `src/adapters/{network,storage}`; it implements a port owned by the application and imports no React, Zustand or UI |
| Is it a user or peer intent run end to end, or state held in-process? | `src/application`: a use case (`useCases/`), or a store (`stores/`) if it only changes that one store. If it reaches another store (beyond round's `patchItem` write, ADR-005), calls a port or triggers an effect, it is a use case, not a store action |
| Is it wiring that picks which adapter fills which port? | `src/app` (composition) |
| Is it something the user sees or does, plus navigation? | the FSD UI, below |

The rules behind this table are in `docs/architecture-rules.md`; cite them by name. Placement
questions map to them like this:

| Question | Rules |
|---|---|
| Can the domain import this, or use this global? | `pure-domain` |
| Is it a pure decision written inline outside the domain? | `pure-decisions-in-domain` |
| May the application import this? | `app-layer-core` |
| What may an adapter import? | `adapters-inward` |
| Do I need a new port? | `ports-at-boundaries` |
| May the UI import an adapter or reach into the application? | `ui-no-adapters`, `composition-root` |
| How does the UI read and write store state? | `ui-reads-views` |
| Store action or use case? | `store-vs-usecase` |
| Does a moved module leave a stale `vi.mock` path? | `no-stale-mocks` |

## UI code

For code in the FSD UI (`pages`, `widgets`, `features`, `entities`, `shared`), read
[fsd-ui.md](fsd-ui.md) in this folder: the FSD layers in use, segments, the public-API rule
and where a new slice belongs (`fsd-downward`). Skip it for domain, application and adapter code.
