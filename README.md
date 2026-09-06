# EstiMate

Live three-point estimation for dev teams — instead of collapsing a backlog item into a single Fibonacci point, EstiMate walks a team through **Best Case / Most Likely / Worst Case** and produces the four numbers stakeholders actually need: **minimum, expected, 90% confidence interval, maximum**.

Based on the three-point estimation method described in the *Developer's Guide to Software Estimation* (agiledojo.de, Episodes I–III).

## Session modes

- **Live mode** (Mode A) — the team estimates together in real time, each participant submitting their own numbers from their own device, connected peer-to-peer (no backend operated by the app — see [ADR-001](docs/adr/001-live-collaboration-architecture.md)).
- **Manual mode** (Mode B) — a facilitator who ran the discussion out-of-band (in person, on a call) types in the team's agreed numbers directly, and gets the same calculated ranges, bias guards, and report.

Both modes share the same calculation engine, bias guards (symmetric-range warning, false-precision guard, outlier flag), and report/history format.

## Status

MVP in progress. Manual mode (Mode B) — session creation, item management, Session View, summary, and history — is built. Live mode (Mode A) has its foundation in place — the Trystero peer-to-peer network layer and the Join Session screen — with the Participant Estimate View and Reveal View still to come. Real persistence (currently in-memory only) is not yet implemented. See the repo's [Issues](../../issues) and [Milestones](../../milestones) for current status.

## Stack

React 19 + TypeScript + Vite, Zustand for state, Nocturne design system (ported as-is), Vitest + Testing Library for tests. See [docs/architecture.md](docs/architecture.md) for the full technical design.

## Development

```
pnpm install

pnpm dev             # start the dev server
pnpm build           # type-check (tsc -b) and production build
pnpm lint            # oxlint
pnpm format          # prettier --write
pnpm format:check    # prettier --check
pnpm test            # vitest run, summary output
pnpm test:verbose    # vitest run, every individual test name and result
pnpm test:coverage   # vitest run --coverage
```

Run `pnpm build`, `pnpm lint`, `pnpm format:check`, and `pnpm test` before considering any change complete.

## Docs

- [docs/prd.md](docs/prd.md) — product requirements
- [docs/architecture.md](docs/architecture.md) — technical architecture, stack, module structure
- [docs/adr/001-live-collaboration-architecture.md](docs/adr/001-live-collaboration-architecture.md) — peer-to-peer live-collaboration architecture decision
- [docs/adr/002-testing-strategy.md](docs/adr/002-testing-strategy.md) — layered test strategy (unit/component now; Playwright deferred until `/network` or `/persistence` are real)
- [docs/concepts/collaboration-mode.md](docs/concepts/collaboration-mode.md) — Live mode technical concept: P2P network layer, join flow, screen wiring
- [AGENTS.md](AGENTS.md) — conventions for AI coding agents working in this repo

## License

[MIT](LICENSE)
