# ADR-002: Layered Testing Strategy — Unit/Component Now, Playwright Deferred

**Status:** Accepted
**Date:** 2026-08-22
**Related:** package.json (vitest, @testing-library/react)

## Context

The app currently has a Vitest + Testing Library suite covering `src/calc/` (the estimation math), `src/state/store.ts` (Zustand state), and most screens/components. Coverage review (2026-08-22) found the calculation core at ~98% and, after this ADR's companion work, all previously zero-coverage components/screens closed.

`src/network/` and `src/persistence/` are currently empty (`.gitkeep` placeholders only, per ADR-001's peer-to-peer/manual-entry architecture, not yet implemented). There is no routing, no real network calls, and no cross-reload persistence to exercise. The app runs entirely in jsdom-testable territory today.

We considered whether to introduce Playwright now, alongside the existing unit/component layer, to build out a classic test-pyramid shape (broad unit base, narrower component middle, thin e2e top) proactively.

## Decision

**We will not add Playwright yet.** We will keep a two-layer strategy for now:

1. **Unit tests** (`src/calc/`, `src/state/store.ts`) — exhaustive coverage of business logic and state transitions. This is the widest layer and stays that way.
2. **Component/screen tests** (Testing Library + jsdom) — one test file per component/screen, covering rendering, interaction, and integration between screens (`App.test.tsx`).

**We will add Playwright as a third, thin layer once `src/network/` and/or `src/persistence/` gain real implementations** — i.e., once there is browser-specific behavior (real reload/persistence, real network/P2P connection handling per ADR-001, routing) that jsdom cannot exercise. When added, it should stay a handful of golden-path smoke tests, not a place to re-test edge cases already covered lower down.

## Rationale

- Playwright's marginal value today is close to zero: nothing in the app currently depends on real browser APIs, real persistence, or real network behavior that jsdom fakes or skips.
- `App.test.tsx` already exercises cross-screen integration in jsdom, covering much of what teams typically reach for e2e tools to get.
- Introducing a browser-driven test runner has real ongoing cost (slower CI, more flakiness surface, additional config/maintenance) that isn't justified without something browser-specific to test.
- Deferring keeps the pyramid shape naturally correct: adding e2e only once there's session-crossing behavior (persistence, P2P connection per ADR-001) to justify it avoids the common anti-pattern of a bloated e2e layer duplicating unit/component coverage.

## Consequences

**Positive**
- No CI time or maintenance cost paid for a layer with nothing meaningful to test yet.
- Forces the trigger for adding e2e to be a real capability (persistence/network), not a calendar date — keeps the eventual Playwright suite scoped to what only it can verify.

**Negative / accepted trade-offs**
- Until Playwright exists, there is no automated coverage of true browser behavior (e.g., actual page reloads, real WebRTC connection failures from ADR-001) — currently acceptable because that behavior doesn't exist yet either.

**Follow-ups / revisit triggers**
- Revisit this ADR when `src/persistence/` or `src/network/` get their first real implementation — that is the trigger to add Playwright, not a fixed date.
- When added, scope Playwright to golden-path flows only (e.g., create session → estimate items → finalize → view summary → history survives reload); keep edge cases in the calc/store/component layers.
- If `src/screens/SessionHistory.tsx` or other screens later block on network/persistence requests, add integration tests at the component layer (mocking the network/persistence boundary) before reaching for Playwright.

## Alternatives considered (summary)

| Option | Rejected because |
|---|---|
| Add Playwright now, proactively shaped like a pyramid | Nothing browser-specific exists yet to test; would add CI cost/flakiness for near-zero coverage gain |
| Skip e2e indefinitely, rely on unit/component tests forever | Once persistence/network (ADR-001) land, real cross-boundary/browser behavior will exist that jsdom can't verify |
