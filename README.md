# EstiMate

Live three-point estimation for dev teams — instead of collapsing a backlog item into a single Fibonacci point, EstiMate walks a team through **Best Case / Most Likely / Worst Case** and produces the four numbers stakeholders actually need: **minimum, expected, 90% confidence interval, maximum**.

Based on the three-point estimation method described in the *Developer's Guide to Software Estimation* (agiledojo.de, Episodes I–III).

## Session modes

- **Live mode** (Mode A) — the team estimates together in real time, each participant submitting their own numbers from their own device, connected peer-to-peer (no backend operated by the app — see [ADR-001](docs/adr/001-live-collaboration-architecture.md)).
- **Manual mode** (Mode B) — a facilitator who ran the discussion out-of-band (in person, on a call) types in the team's agreed numbers directly, and gets the same calculated ranges, bias guards, and report.

Both modes share the same calculation engine, bias guards (symmetric-range warning, false-precision guard, outlier flag), and report/history format.

## Status

MVP in progress. Single-user mode — mode selection, the unified Workspace (item list + estimation), summary, and history — is built. Live mode (Mode A) is built end to end — the Trystero peer-to-peer network layer, the Join Session screen, the participant estimating flow, and the facilitator reveal / retry-round flow (a Workspace state, not a separate screen). Connection-fallback UX (#9) and real persistence (currently in-memory only) are still to come. See the [EstiMate Roadmap](https://github.com/users/cfisch3r/projects/1) project board and the repo's [Issues](../../issues) for current status.

## Stack

React 19 + TypeScript + Vite, Zustand for state, Nocturne design system (ported as-is), Vitest + Testing Library for tests. See [docs/architecture.md](docs/architecture.md) for the full technical design.

## Development

```
pnpm install

pnpm dev                  # start the dev server
pnpm build                # type-check (tsc -b) and production build
pnpm typecheck            # type-check only (tsc -b), no bundling
pnpm preview              # serve the production build locally
pnpm lint                 # oxlint
pnpm arch                 # steiger — FSD architecture boundary check
pnpm format               # prettier --write
pnpm format:check         # prettier --check
pnpm test                 # vitest run, summary output
pnpm test:watch           # vitest in watch mode
pnpm test:verbose         # vitest run, every individual test name and result
pnpm test:coverage        # vitest run --coverage
pnpm test:e2e             # Playwright, real WebRTC via a local self-hosted relay (ADR-007)
pnpm test:e2e:real-world  # same specs against production signaling (public Nostr relays)
pnpm test:e2e:ui          # Playwright UI mode, for local debugging
pnpm deadcode             # knip — unused exports/files/dependencies
```

Run `pnpm build`, `pnpm lint`, `pnpm arch`, `pnpm format:check`, `pnpm test`, and
`pnpm deadcode` before considering any change complete. These also run as required checks
in CI (`.github/workflows/ci.yml`) on every PR and push to `main` — `pnpm test:e2e` does
too (needs `pnpm exec playwright install --with-deps chromium` once beforehand).
`pnpm test:e2e:real-world` only runs on a nightly schedule and manual dispatch
(`.github/workflows/e2e-real-world.yml`); it never gates a PR.

## Docs

- [docs/prd.md](docs/prd.md) — product requirements
- [docs/architecture.md](docs/architecture.md) — technical architecture, stack, module structure
- [docs/adr/001-live-collaboration-architecture.md](docs/adr/001-live-collaboration-architecture.md) — peer-to-peer live-collaboration architecture decision
- [docs/adr/002-testing-strategy.md](docs/adr/002-testing-strategy.md) — layered test strategy: unit/component, plus a thin Playwright e2e layer since #26 (see ADR-007)
- [docs/adr/003-session-reliability-model.md](docs/adr/003-session-reliability-model.md) — facilitator-authoritative round state, versioned rounds, stable client identity, and related live-session reliability decisions
- [docs/adr/004-feature-sliced-design-architecture.md](docs/adr/004-feature-sliced-design-architecture.md) — Feature-Sliced Design (FSD) as the enforced architecture: layer set, slice mapping, staged follow-ups
- [docs/adr/005-session-store-decomposition.md](docs/adr/005-session-store-decomposition.md) — accepted decision on the session store's split into three per-concern stores (`src/application/stores/{session,connection,round}.ts`)
- [docs/adr/006-router-adoption.md](docs/adr/006-router-adoption.md) — accepted decision on replacing faked `currentScreen` navigation with react-router
- [docs/adr/007-e2e-dual-mode-signaling.md](docs/adr/007-e2e-dual-mode-signaling.md) — Playwright e2e tests for the P2P layer: a locally self-hosted signaling relay by default, production Nostr relays in a separate nightly job
- [docs/concepts/collaboration-mode.md](docs/concepts/collaboration-mode.md) — Live mode technical concept: P2P network layer, join flow, screen wiring
- [docs/concepts/e2e-testing.md](docs/concepts/e2e-testing.md) — E2E testing technical concept: Playwright/fixture/signaling component wiring, dual-mode build-and-run flows, spec-to-wire-action coverage map
- [docs/runbook.md](docs/runbook.md) — deployment & release runbook: CD pipeline, secrets, troubleshooting, versioning/releases
- [AGENTS.md](AGENTS.md) — conventions for AI coding agents working in this repo

## License

[MIT](LICENSE)
