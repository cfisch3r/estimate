# ADR-007: Dual-Mode Signaling for Playwright E2E Tests

**Status:** Accepted
**Date:** 2026-09-30
**Related:** [002-testing-strategy.md](002-testing-strategy.md), [001-live-collaboration-architecture.md](001-live-collaboration-architecture.md), issue #26

## Context

ADR-002 deferred Playwright until `entities/session/api` (the Trystero P2P
layer) had a real implementation with browser-specific behavior — real
WebRTC connect/drop, real cross-browser message exchange — that jsdom/unit
tests can't exercise. That implementation has since landed and is already
covered at the unit level via a fake `ActionRoom` (`actions.test.ts`,
`session.test.ts`). Issue #26 is the trigger ADR-002 named: add a thin
Playwright layer of golden-path smoke tests for the real thing.

The wrinkle: two real browser contexts connecting via Trystero's production
signaling strategy (`trystero/nostr`, public relays) would make every PR's
test run depend on a third party's uptime and latency — precisely the kind
of flakiness ADR-002 flagged as Playwright's real ongoing cost.

## Decision

**Dual-mode signaling.** Both modes exercise real WebRTC between real browser
contexts — neither is the in-memory `ActionRoom` mock the unit tests already
use, which would test nothing new.

1. **Default (every CI run, blocking)** — a locally self-hosted relay,
   `@trystero-p2p/ws-relay` (a sibling Trystero package built for exactly
   this: a single tiny WebSocket server, no TURN/STUN infrastructure of its
   own). `e2e/relay-server.mjs` starts it as a Playwright `webServer` entry;
   `VITE_TRYSTERO_RELAY_URL` points the app's e2e build at it. Real ICE/DTLS
   handshake, real data-channel exchange, zero third-party dependency.
2. **"Real-world" (nightly + manual, non-blocking)** — the unmodified
   production build (`trystero/nostr`, public relays), run via
   `.github/workflows/e2e-real-world.yml`. Confirms the actual production
   signaling path still works, without gating merges on a third party's
   uptime.

**The seam** — a guarded dynamic import, resolved once at module init:
- `src/entities/session/api/signaling.ts` wraps the production `joinRoom`
  call (`trystero/nostr`) behind `joinSignalingRoom(sessionId, options)`.
- `src/entities/session/api/signaling.wsRelay.ts` implements the same
  signature via `@trystero-p2p/ws-relay`, reading the relay URL from
  `import.meta.env.VITE_TRYSTERO_RELAY_URL`. Both implementations share their
  types/constant through `signalingContract.ts` — the contract they both
  satisfy, not a grab-bag of "shared stuff."
- `session.ts` picks between them with a **top-level await**, resolved once
  when the module first loads, not inside `joinSession()` on every call:
  ```ts
  const { joinSignalingRoom } =
    import.meta.env.MODE === 'e2e'
      ? await import('./signaling.wsRelay')
      : await import('./signaling')
  ```
  This is the pattern the wider ecosystem uses to keep test/dev-only code out
  of a production bundle (Mock Service Worker's own setup guide recommends
  the same guarded-dynamic-import shape). Once Vite inlines
  `import.meta.env.MODE` as a literal, the unreached `import()` call is
  ordinary dead code eliminated during Vite's per-file transform, before
  Rollup ever builds its chunk graph — confirmed by bundle inspection (see
  "Alternatives considered" for the two mechanisms tried and rejected before
  this one, and why). Resolving it once at module scope, rather than per
  `joinSession()` call, keeps `joinSession` itself fully synchronous — no
  ripple into `NetworkProvider.connect()` or its four call sites.
- Real-world mode uses the default Vite mode — the ternary resolves to
  `signaling.ts` either way, so it's literally the production code path.

**CI gating: blocking.** The local relay removes ADR-002's actual worry
(third-party dependency); what's left — real handshake timing, shared-runner
resource contention, first-run teething issues — is mitigated with generous
timeouts, a small bounded worker count in CI, and limited CI retries, not by
keeping the suite non-blocking.

**Scope: Chromium only**, matching ADR-002's "handful of golden-path smoke
tests" framing — the same reason the specs stay to four scenarios (create +
join, submit + reveal, syncState propagation, late-joiner snapshot) rather
than re-testing edge cases already covered by the unit-level `actions.ts`
validation/sanitization tests.

## Rationale

**Why a guarded dynamic import, not a bundler alias or a static-import
ternary — three mechanisms were tried, in this order:**

1. **`resolve.alias` matching the literal `'./signaling'` specifier.** Works
   for `session.ts`, but matches from *any* importer — including, during
   development of this ADR, `signaling.wsRelay.ts`'s own import of shared
   constants from `./signaling`, which got aliased back to itself and broke
   on missing exports. (That incident is why shared bits live in
   `signalingContract.ts` rather than being re-exported from `signaling.ts`.)
   Rejected for the any-importer coincidence, not because it failed to work.
2. **A plain `import.meta.env.MODE === 'e2e'` ternary between two
   *statically*-imported implementations, no bundler plugin at all.**
   Measured to fail outright: the production bundle grew from 484KB/152KB
   gzip to 534KB/169KB gzip and started shipping `@trystero-p2p/ws-relay`
   code. A static `import` is bound into Rollup's module graph unconditionally
   — ES module bindings are hoisted by spec — so Rollup keeps it regardless
   of which branch of a later runtime ternary is actually reachable.
3. **A scoped Vite `resolveId` plugin**, matching on `mode`, the specifier,
   *and* the importer's file path together. This worked and was measured
   correct (production bundle back to exactly 250 modules / 484.19KB /
   152.39KB gzip, zero ws-relay code in the output), fixing option 1's
   any-importer gap. Superseded anyway in favor of option 4 below, since it
   still required bespoke Vite-config code for something the ecosystem
   already has an idiom for.
4. **A guarded dynamic `import()`, resolved once via top-level await** (the
   adopted approach, detailed above). Unlike option 2, a dynamic `import()`
   is an ordinary function call, not a hoisted binding — ordinary dead-code
   elimination applies to it. Measured correct: same 250 modules / zero
   ws-relay code, plus zero custom Vite-plugin code. The one trade-off
   (accepted): `signaling.ts` — the production strategy — is now its own
   lazily-loaded chunk (~59KB/22KB gzip), fetched on the first `joinSession()`
   call rather than bundled eagerly into the initial load. Since signaling is
   only ever needed once a user actually starts or joins a **live** session
   (never for Manual mode), this is an acceptable, arguably-beneficial
   deferral, not a regression.

**Why this doesn't conflict with ADR-001.** ADR-001 requires the **shipped
product** never depend on a server the app operates — that's about what
ships to users, not test infrastructure. The `ws-relay` instance in
`e2e/relay-server.mjs` only ever runs inside a CI job or a contributor's own
machine, is never part of a production build (confirmed by inspecting the
built bundle — see above), and is torn down with the test run. Writing this
down explicitly so a future reader doesn't mistake "CI has a relay process"
for "the product now depends on a self-run server."

## Consequences

**Positive**
- Closes ADR-002's own stated revisit trigger with the scope it asked for:
  a thin layer, not a duplicate of unit-level edge-case coverage.
- Every PR gets real-WebRTC coverage with no public-infrastructure
  dependency or its flakiness.
- The production code path is untouched by test concerns beyond one
  indirection (`session.ts` → `signaling.ts`); `signaling.wsRelay.ts` is
  never in the production module graph — confirmed by bundle inspection,
  not just by the mechanism's design.

**Negative / accepted trade-offs**
- `signaling.ts` (the production strategy) is now a separate lazily-loaded
  chunk, fetched on the first `joinSession()` call rather than bundled
  eagerly — one extra network round-trip the first time a user starts or
  joins a live session. Accepted since Manual mode never touches it at all.
- A second, non-blocking CI surface (`e2e-real-world.yml`) to notice when it
  fails — it won't block a PR, so it needs someone to actually look at it.
- Specs run in parallel against one shared relay, relying on each spec
  generating its own session code (a disjoint Trystero room); a spec that ever
  reused a fixed code would collide with its neighbours.
- First real PRs against this suite are where any local-relay-specific
  teething issue (port conflicts, timing) would surface — mitigated, not
  eliminated, by generous timeouts and CI retries.

**Follow-ups / revisit triggers**
- If the suite grows meaningfully past "a handful of golden-path tests,"
  revisit the CI worker count and Chromium-only scope.
- If `e2e-real-world.yml` starts failing regularly against public Nostr
  relays with no corresponding local-mode failure, that's a signal about
  production signaling health, not test infrastructure — investigate the
  relays/strategy, not the test.

## Alternatives considered (summary)

| Option | Rejected because |
|---|---|
| Mock Trystero's `joinRoom` entirely (fake in-memory room) as the default | Already exists as the unit-test layer (`ActionRoom`); running Playwright against it would test nothing new and defeat the reason for adding Playwright at all |
| Public Nostr relays as the only/default mode | Ties every PR's pass/fail to third-party uptime/latency — exactly ADR-002's flakiness concern |
| A different self-hostable strategy (`trystero/mqtt`, `trystero/torrent`) | Both work, but require heavier self-hosted infra (a full MQTT broker or BitTorrent tracker) than `ws-relay`, which was purpose-built for this exact case |
| Explicit dependency injection: `import.meta.env.MODE` ternary between two statically-imported strategies, no bundler plugin | More type-safe on paper, but measured to fail the actual requirement — Rollup includes both statically-imported branches regardless of which one is reachable, so `@trystero-p2p/ws-relay` shipped in the production bundle (+50KB/+16KB gzip) |
| `resolve.alias`, plain string match on `'./signaling'` | Works, but matches the literal specifier from any importer — including `signaling.wsRelay.ts`'s own shared-constant import, aliasing it back to itself |
| Scoped Vite `resolveId` plugin (mode + specifier + importer) | Worked and was measured correct, but is bespoke Vite-config code for something the ecosystem already has an idiom for (see the adopted option) |
| A local pnpm workspace package with `package.json` `exports` conditions (the Node-native, Gradle/Maven-source-set-style mechanism) | Real and standardized, but `exports` maps only apply at a package boundary — would require adopting workspace tooling for one internal seam in a single-package repo |
