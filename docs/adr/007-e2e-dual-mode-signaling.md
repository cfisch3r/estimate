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

**The seam** — a build-time module swap, not a runtime branch:
- `src/entities/session/api/signaling.ts` wraps the production `joinRoom`
  call (`trystero/nostr`) behind `joinSignalingRoom(sessionId, options)`.
  `session.ts` imports this instead of calling Trystero directly.
- `src/entities/session/api/signaling.wsRelay.ts` implements the same
  signature via `@trystero-p2p/ws-relay`, reading the relay URL from
  `import.meta.env.VITE_TRYSTERO_RELAY_URL`.
- `vite.config.ts` aliases `./signaling` → `./signaling.wsRelay` only when
  Vite's `mode === 'e2e'`. A production build never resolves the test-only
  file at all — no runtime conditional ships to users, and no lazy chunk for
  code that's never used in production.
- Real-world mode uses the default Vite mode (no alias) — it's literally the
  production code path, just pointed at the real thing.

**CI gating: blocking.** The local relay removes ADR-002's actual worry
(third-party dependency); what's left — real handshake timing, shared-runner
resource contention, first-run teething issues — is mitigated with generous
timeouts, `workers: 1` (one shared relay instance per run, so specs don't
race each other for it), and limited CI retries, not by keeping the suite
non-blocking.

**Scope: Chromium only**, matching ADR-002's "handful of golden-path smoke
tests" framing — the same reason the specs stay to four scenarios (create +
join, submit + reveal, syncState propagation, late-joiner snapshot) rather
than re-testing edge cases already covered by the unit-level `actions.ts`
validation/sanitization tests.

## Does this conflict with ADR-001?

No. ADR-001 requires the **shipped product** never depend on a server the
app operates — that's about what ships to users, not test infrastructure.
The `ws-relay` instance in `e2e/relay-server.mjs` only ever runs inside a CI
job or a contributor's own machine, is never part of a production build (the
alias above guarantees `signaling.wsRelay.ts` is unreachable from
`vite build`'s default mode), and is torn down with the test run. Writing
this down explicitly so a future reader doesn't mistake "CI has a relay
process" for "the product now depends on a self-run server."

## Consequences

**Positive**
- Closes ADR-002's own stated revisit trigger with the scope it asked for:
  a thin layer, not a duplicate of unit-level edge-case coverage.
- Every PR gets real-WebRTC coverage with no public-infrastructure
  dependency or its flakiness.
- The production code path is untouched by test concerns beyond one
  indirection (`session.ts` → `signaling.ts`); `signaling.wsRelay.ts` is
  never in the production module graph.

**Negative / accepted trade-offs**
- A second, non-blocking CI surface (`e2e-real-world.yml`) to notice when it
  fails — it won't block a PR, so it needs someone to actually look at it.
- `workers: 1` means the e2e job doesn't parallelize; acceptable while the
  suite stays at four specs per ADR-002's scope.
- First real PRs against this suite are where any local-relay-specific
  teething issue (port conflicts, timing) would surface — mitigated, not
  eliminated, by generous timeouts and CI retries.

**Follow-ups / revisit triggers**
- If the suite grows meaningfully past "a handful of golden-path tests,"
  revisit `workers: 1` and Chromium-only scope.
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
