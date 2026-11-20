# ADR-011: The `integration` Test Level

**Status:** Accepted
**Date:** 2026-11-19
**Related:** [010-spec-first-gherkin-specs.md](010-spec-first-gherkin-specs.md), [007-e2e-dual-mode-signaling.md](007-e2e-dual-mode-signaling.md), [009-architecture-style-fsd-vs-hexagonal-core.md](009-architecture-style-fsd-vs-hexagonal-core.md), [integration-testing.md](../concepts/integration-testing.md), [glossary.md](../../glossary.md)

## Context

ADR-010 set up two Test Levels: `e2e`, which clicks the real UI in real browsers, and
`domain`, which calls the pure domain directly. Neither reaches the outbound adapters
(ADR-009) on their own terms:

- **`e2e` sees screens**<br>
  It sees an adapter only through a screen. It can check one user path per behaviour, but
  not what an adapter reports, records or hands to the browser in detail.
- **Unit tests mock the boundary**<br>
  The adapters' unit tests mock Trystero, `localStorage` and object URLs, so they can't
  show how the real browser APIs behave.

Every outbound adapter wraps a browser API: WebRTC through Trystero, `localStorage`, Blob
downloads. Node has none of them, and jsdom fakes the parts that matter. Trystero also
keeps per-page module state (its own peer id, its shared connections, its room cache), so
two peers in one page share one identity. ADR-010 reserved a deferred `protocol` Test
Level for the peer wire protocol, but never defined it.

## Decision

Add a third Test Level, **`integration`**: scenarios drive each outbound adapter through
the port the application owns, in a real browser, against real external systems. It
replaces ADR-010's deferred `protocol` Test Level.

- **Runner**<br>
  `playwright-bdd`, in Playwright projects named `<concept>-integration`, separate from
  the `*-bdd` (`e2e`) projects. Features live in `specs/<concept>/integration/`, shared
  driver code in `specs/shared/integration/`.
- **Harness page**<br>
  A test-only Vite page (`specs/shared/integration/harness/`, served by
  `vite.harness.config.ts`, which sets Vite's mode to `e2e`) imports the real adapters and
  installs one global, `window.__harness`, with one entry per port. Each peer or browser
  is its own Playwright browser context; tabs of the same browser share one.
- **Port drivers**<br>
  Steps never call `page.evaluate`. They call port drivers whose types are derived from
  the harness entry's port type (`Remote<Port>`: every operation async, `on…` callbacks
  left out), through one generic forwarder. The harness object is declared
  `satisfies Harness`. Renaming or removing a port operation, or changing a parameter's
  type, therefore fails `pnpm typecheck` in the harness and in every step that uses it. A
  parameter added to the port is the one exception the harness side doesn't catch:
  TypeScript accepts a function with fewer parameters.
- **Callbacks**<br>
  Callbacks can't cross from the page into Node. The harness will append each one to an
  in-page journal, which steps read and wait on with `expect.poll`. The journal is built
  together with the first port that has callbacks.
- **Faults**<br>
  Faults are injected only through the browser or Playwright (going offline, an init
  script that makes `localStorage.setItem` throw), or through a real configuration the
  adapter honours anyway. Adapter internals and Trystero are never stubbed. A fault is
  added only when a scenario needs it.
- **Import rules**<br>
  Harness code may import `src/adapters`, `src/application/ports/outbound` and
  `src/domain`. Integration steps, drivers and the world fixture may take types only from
  `src/`, and only port and domain types. All three are dependency-cruiser rules with a
  canary test.
- **Signaling**<br>
  The integration projects run in local mode only, against the local relay (ADR-007).
  Real-world mode leaves them out, because it starts neither the relay nor the harness.

## Rationale

- **The browser is observable**<br>
  Playwright can observe what only the browser knows: a real `download` event, a reload, a
  second tab sharing storage, going offline. That's why one runner covers every adapter,
  not only the network one.
- **Drivers follow ports**<br>
  Deriving port drivers from ports removes the one maintenance cost drivers add: a
  hand-kept method list that drifts from the port.
- **A journal, not push**<br>
  A journal instead of pushing events to Node keeps events ordered and needs no teardown
  of exposed functions.

## Consequences

- **A third web server**<br>
  The harness dev server runs on its own port, next to the relay and the app build. It's
  never reused and starts with `--strictPort`, so a server already on that port (another
  worktree's harness, for example) makes the run fail loudly instead of testing the wrong
  checkout.
- **React-free port files**<br>
  Port interfaces live in React-free files under `src/application/ports/outbound/`; the
  React contexts that provide them import those types. That keeps React out of the
  harness's dependency graph.
- **One runner, two Test Levels**<br>
  `e2e` and `integration` share playwright-bdd but stay separate Test Levels, with their
  own Playwright projects, fixtures and driver code. ADR-010's "one scenario, one Test
  Level" and "no shared DSL across Test Levels" still hold.
- **Unit tests stay**<br>
  The mocked adapter unit tests stay for the adapters' own logic. How much overlap to
  remove between them and the integration scenarios is an open follow-up.

## Alternatives considered (summary)

| Option | Rejected because |
|---|---|
| Vitest browser mode with quickpickle | One test file runs in one page, so several peers would need iframes with separate module instances: new and awkward infrastructure, even though steps could call ports directly and fully typed |
| Node with a WebRTC polyfill passed to Trystero | Not the browser's own WebRTC stack, which is what the network scenarios need to observe, and peers in one process still share Trystero's state |
| Reading Trystero's open connections from the app | Sees only connections that came up, not the failures this level exists to check |
