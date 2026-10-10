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

The rules behind this table are in `docs/architecture-rules.md`; cite them by ID. Placement
questions map to them like this:

| Question | Rules |
|---|---|
| Can the domain import this, or use this global? | R1 |
| Is it a pure decision written inline outside the domain? | R10 |
| May the application import this? | R2 |
| What may an adapter import? | R3 |
| Do I need a new port? | R9 |
| May the UI import an adapter or reach into the application? | R5, R6 |
| How does the UI read and write store state? | R7 |
| Store action or use case? | R8 |
| Does a moved module leave a stale `vi.mock` path? | R11 |

## UI code

For code in the FSD UI (`pages`, `widgets`, `features`, `entities`, `shared`), read
[fsd-ui.md](fsd-ui.md) in this folder: the FSD layers in use, segments, the public-API rule
and where a new slice belongs (R4). Skip it for domain, application and adapter code.
