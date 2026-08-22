# AGENTS.md

Instructions for any AI coding agent working in this repository.

## Project context

EstiMate is a live three-point estimation tool for dev teams. Before making non-trivial changes, read:

- `PRD-estimation-app.md` — product requirements
- `ADR-001-live-collaboration-architecture.md` — accepted decision on the peer-to-peer live-collaboration architecture
- `ADR-002-testing-strategy.md` — accepted decision on the layered test strategy (unit/component now; Playwright deferred until `/network` or `/persistence` get real implementations — see that ADR before adding e2e tests or building those modules)
- `ARCHITECTURE-estimation-app.md` — the technical architecture (stack, module structure, `/calc` design) and decisions made building it
- `design_handoff_estimate_app/` — the design reference (Nocturne design system, clickable HTML prototype). Not production code to copy directly.

## Commands

```
pnpm dev             # start the dev server
pnpm build            # type-check (tsc -b) and production build
pnpm lint             # oxlint
pnpm format           # prettier --write
pnpm format:check     # prettier --check
pnpm test             # vitest run, summary output
pnpm test:verbose     # vitest run, every individual test name and result
pnpm test:coverage    # vitest run --coverage
```

Run `pnpm build`, `pnpm lint`, `pnpm format:check`, and `pnpm test` before considering any change complete.

## Code conventions

- **TypeScript strict mode** (`strict: true`, `noUncheckedIndexedAccess: true`) — don't loosen these.
- **Domain types with invariants are self-validating value types, not bare interfaces.** If a type has a constraint between its fields (e.g. an ordering, a required relationship), it should only be constructible through a factory that enforces the constraint, so illegal states can't be represented — see `src/calc/estimate.ts`'s `createEstimate()` for the pattern (a `Result`-returning factory plus a compile-time-only phantom brand, so the type stays plain, JSON-transparent data). Don't reintroduce a bare structurally-typed interface for a concept that has a real invariant.
- **`/calc` is pure and framework-free** — no React, no I/O, no network/storage imports. Functions there should be thoroughly unit-tested (the module currently sits at 100% statement/branch coverage on its real surface — test helpers' defensive-throw branches are the one deliberate exception).
- **Nocturne's `src/design/nocturne.css` is a verbatim, unmodified port** of the design system's canonical stylesheet — don't edit it to add app-specific styling. New composed patterns built from Nocturne primitives (e.g. `radio-tile.css`) live in their own file instead, so `nocturne.css` stays a clean diff against its source if the design system is ever re-pulled.
- Guard/validation functions return structured results (`{fired, deviationPct}`, `{ok, value/error}`) rather than throwing or returning bare booleans, so callers can access the reasoning, not just the verdict.

## Commit conventions

- Do not add a `Co-Authored-By: Claude` (or similar AI co-author) trailer to commit messages in this repo.
- Prefer new commits over amending; one milestone/logical change per commit.
