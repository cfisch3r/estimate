# EstiMate

Live three-point estimation for dev teams — instead of collapsing a backlog item into a single Fibonacci point, EstiMate walks a team through **Best Case / Most Likely / Worst Case** and produces the four numbers stakeholders actually need: **minimum, expected, 90% confidence interval, maximum**.

Based on the three-point estimation method described in the *Developer's Guide to Software Estimation* (agiledojo.de, Episodes I–III).

## Session modes

- **Live Collaborative** — the team estimates together in real time, each participant submitting their own numbers from their own device, connected peer-to-peer (no backend operated by the app — see [ADR-001](ADR-001-live-collaboration-architecture.md)).
- **Manual Entry** — a facilitator who ran the discussion out-of-band (in person, on a call) types in the team's agreed numbers directly, and gets the same calculated ranges, bias guards, and report.

Both modes share the same calculation engine, bias guards (symmetric-range warning, false-precision guard, outlier flag), and report/history format.

## Status

MVP in progress. Manual Entry (Mode B) — session creation, item management, session view, summary, and history — is built. Live Collaborative (Mode A: peer-to-peer networking, join/participant/reveal screens) and real persistence (currently in-memory only) are not yet implemented. See the repo's [Issues](../../issues) and [Milestones](../../milestones) for current status.

## Stack

React 19 + TypeScript + Vite, Zustand for state, Nocturne design system (ported as-is), Vitest + Testing Library for tests. See [ARCHITECTURE-estimation-app.md](ARCHITECTURE-estimation-app.md) for the full technical design.

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

- [PRD-estimation-app.md](PRD-estimation-app.md) — product requirements
- [ADR-001-live-collaboration-architecture.md](ADR-001-live-collaboration-architecture.md) — peer-to-peer live-collaboration architecture decision
- [ADR-002-testing-strategy.md](ADR-002-testing-strategy.md) — layered test strategy (unit/component now; Playwright deferred until `/network` or `/persistence` are real)
- [ARCHITECTURE-estimation-app.md](ARCHITECTURE-estimation-app.md) — technical architecture, stack, module structure
- [AGENTS.md](AGENTS.md) — conventions for AI coding agents working in this repo

## License

[MIT](LICENSE)
