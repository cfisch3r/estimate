# EstiMate

Live three-point estimation for dev teams — instead of collapsing a backlog item into a single Fibonacci point, EstiMate walks a team through **Best Case / Most Likely / Worst Case** and produces the four numbers stakeholders actually need: **minimum, expected, 90% confidence interval, maximum**.

Based on the three-point estimation method described in the *Developer's Guide to Software Estimation* (agiledojo.de, Episodes I–III).

## Session modes

- **Live mode** (Mode A) — the team estimates together in real time, each participant submitting their own numbers from their own device, connected peer-to-peer (no backend operated by the app — see [ADR-001](docs/technical/adr/001-live-collaboration-architecture.md)).
- **Manual mode** (Mode B) — a facilitator who ran the discussion out-of-band (in person, on a call) types in the team's agreed numbers directly, and gets the same calculated ranges, bias guards, and report.

Both modes share the same calculation engine, bias guards (symmetric-range warning, false-precision guard, outlier flag), and report and session-file format.

## Status

MVP in progress. Single-user mode — mode selection, the unified Workspace (item list + estimation), and summary — is built, and a session can be saved to a JSON file and loaded again. Live mode (Mode A) is built end to end — the Trystero peer-to-peer network layer, the Join Session screen, the participant estimating flow, and the facilitator reveal / retry-round flow (a Workspace state, not a separate screen). Connection-fallback UX (#9) is still to come. See the repo's [Issues](../../issues) for current status.

## Stack

React 19 + TypeScript + Vite, Zustand for state, Nocturne design system (ported as-is), Vitest + Testing Library for tests. See [docs/technical/architecture.md](docs/technical/architecture.md) for the full technical design.

## Development

```
pnpm install

pnpm dev                  # start the dev server
pnpm build                # type-check (tsc -b) and production build
pnpm typecheck            # type-check only (tsc -b), no bundling
pnpm preview              # serve the production build locally
pnpm lint                 # oxlint
pnpm arch                 # steiger (FSD inside the UI) and dependency-cruiser (layer rules, `pnpm arch:layers`)
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

- [docs/README.md](docs/README.md) — the documentation index: domain docs (what EstiMate does), technical docs (how it's built), and shared vocabulary
- [AGENTS.md](AGENTS.md) — conventions for AI coding agents working in this repo

## License

[MIT](LICENSE)
