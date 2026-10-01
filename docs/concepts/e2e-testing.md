# Live Collaboration E2E Testing — Technical Concept

## Overview

Four Playwright specs (`e2e/specs/*.spec.ts`) drive real, separate browser contexts
against a real built app to exercise WebRTC connection behavior no unit/jsdom test can
reach. Signaling is swappable at build time between a locally self-hosted relay
(default) and the production Nostr strategy ("real-world" mode).

This doc covers what exists and how it's wired. [ADR-007](../adr/007-e2e-dual-mode-signaling.md)
is the decision record — why dual-mode, why this relay, why blocking CI. This doc is
scoped to the e2e/Playwright layer specifically; the broader QA/guardrails system
(oxlint, Steiger, knip, hooks, CI layering) is tracked separately (#114).

## Component view

Structural only — no mode-specific behavior here (see the two flow diagrams below for
that). Lines: **solid** = import/call, **dotted** = build-time/config-time wiring.

```mermaid
flowchart TD
  subgraph e2elane["E2E LANE · e2e/*"]
    direction LR
    Specs["4 spec files<br/>[Playwright Test Files]"]
    Fixtures["facilitator / participant / lateJoiner<br/>[Playwright Fixture]"]
    Helpers["session / join / item / estimate helpers<br/>[Test Helper Module]"]
    RelayScript["relay-server.mjs<br/>[Node Script]"]
  end

  subgraph configlane["CONFIG LANE · repo root"]
    direction LR
    PWConfig["playwright.config.ts<br/>[Test Runner Config]"]
    ViteConfig["vite.config.ts<br/>[Build Config]"]
  end

  subgraph signalinglane["ENTITIES: SESSION (SIGNALING) LANE · entities/session/api"]
    direction LR
    SessionFactory["session.ts (joinSession)<br/>[Factory Function]"]
    SigProd["signaling.ts<br/>[Signaling Strategy: Production]"]
    SigTest["signaling.wsRelay.ts<br/>[Signaling Strategy: Test-only]"]
    SigShared["signalingContract.ts<br/>[Shared Contract: Types & Constants]"]
  end

  WsRelayLib["@trystero-p2p/ws-relay<br/>[External Library — self-hosted WS relay]"]
  NostrLib["trystero/nostr<br/>[External Library — public relay signaling]"]
  Chromium["Chromium<br/>[Browser, Playwright-controlled]"]

  Specs -->|"use"| Fixtures
  Specs -->|"call"| Helpers
  Fixtures -->|"open/close contexts"| Chromium
  Helpers -->|"drive via Page API"| Chromium
  PWConfig -->|"webServer: starts"| RelayScript
  PWConfig -->|"webServer: `vite build/preview --mode e2e`"| ViteConfig
  RelayScript -->|"createWsRelayServer()"| WsRelayLib
  SessionFactory -.->|"top-level await import() —<br/>mode=e2e only"| SigTest
  SessionFactory -->|"joinSignalingRoom()"| SigProd
  SigProd -->|"APP_ID, types"| SigShared
  SigTest -->|"APP_ID, types"| SigShared
  SigProd -->|"joinRoom()"| NostrLib
  SigTest -->|"joinRoom({ relayConfig })"| WsRelayLib
  Chromium -.->|"loads the built bundle"| SessionFactory

  classDef e2e   fill:#DDD6FE,stroke:#7C3AED,color:#2E1065
  classDef cfg   fill:#FDE68A,stroke:#D97706,color:#3F2D0B
  classDef sig   fill:#99F6E4,stroke:#0D9488,color:#042F2A
  classDef ext   fill:#FFEDD5,stroke:#EA580C,color:#3F1D0B,stroke-dasharray:5 4

  class Specs,Fixtures,Helpers,RelayScript e2e
  class PWConfig,ViteConfig cfg
  class SessionFactory,SigProd,SigTest,SigShared sig
  class WsRelayLib,NostrLib,Chromium ext

  style e2elane fill:#F5F3FF,stroke:#7C3AED,stroke-width:2px
  style configlane fill:#FFFBEB,stroke:#D97706,stroke-width:2px
  style signalinglane fill:#F0FDFA,stroke:#0D9488,stroke-width:2px
```

`session.ts` resolves the top-level `await import(...)` once, at module init — not per
`joinSession()` call — so `joinSession` itself stays synchronous. One accepted side
effect: `signaling.ts` (the production strategy) is now its own lazily-loaded chunk,
fetched on the first `joinSession()` call rather than bundled eagerly (see ADR-007).

## Default (local relay) build & run flow

```mermaid
flowchart TD
  A["playwright.config.ts"] -->|1| B["relay-server.mjs starts,<br/>listens ws://localhost:8971"]
  A -->|2| C["vite build --mode e2e<br/>VITE_TRYSTERO_RELAY_URL=ws://localhost:8971"]
  C -->|3| D["bundle: session.ts's top-level await<br/>picks signaling.wsRelay.ts (mode=e2e)"]
  A -->|4| E["vite preview --mode e2e<br/>serves bundle on :4173"]
  A -->|5| F["2-3 Chromium contexts<br/>navigate to :4173"]
  F -->|6| G["each: joinSignalingRoom()<br/>→ ws-relay client → relay :8971"]
  G <-->|"7 direct WebRTC data channel<br/>(sendEstimate / syncState / requestSnapshot)"| G

  classDef step fill:#BFDBFE,stroke:#2563EB,color:#0B2545
  class A,B,C,D,E,F,G step
```

## Real-world build & run flow

```mermaid
flowchart TD
  A["playwright.config.ts<br/>(PW_MODE=real-world)"] -.->|"skipped: no relay"| B["relay-server.mjs"]
  A -->|1| C["vite build (default mode)"]
  C -->|2| D["bundle: session.ts's top-level await<br/>picks signaling.ts (mode≠e2e)"]
  A -->|3| E["vite preview serves bundle on :4173"]
  A -->|4| F["2-3 Chromium contexts<br/>navigate to :4173"]
  F -->|5| G["each: joinSignalingRoom()<br/>→ trystero/nostr → public relays"]
  G <-->|"6 direct WebRTC data channel"| G

  classDef step fill:#BFDBFE,stroke:#2563EB,color:#0B2545
  classDef skipped fill:transparent,stroke-dasharray:2 2,color:gray
  class A,C,D,E,F,G step
  class B skipped
```

## Fixture roles

| Fixture | Browser context | Represents |
|---|---|---|
| `facilitator` | own context | Creates the session, holds the Workspace/reveal view |
| `participant` | own context | Joins via code, submits estimates |
| `lateJoiner` | own context | Joins mid-round, exercises `requestSnapshot` pull-on-arrival |

Separate contexts (not tabs) because `JoinSession`'s own identity warning — "joining
from another tab in this browser will be treated as the same person" — means
same-context pages would collide on `participantId`; contexts have isolated storage.

## Spec → wire-action coverage

| Spec | Exercises | Not covered here (stays unit-level) |
|---|---|---|
| `create-and-join` | `joinSession`, `onPeerJoin`, `sendAnnounce`/`onAnnounce` | payload validation, retry/backoff timing |
| `submit-and-reveal` | `sendEstimate`/`onEstimate` (request/ack), reveal → `syncState` broadcast | malformed-estimate rejection, ack timeout handling |
| `sync-state-propagation` | `syncState` broadcast (item change, unit change) | snapshot field-level tolerance/defaults |
| `late-joiner-snapshot` | `requestSnapshot`/`onRequestSnapshot` (ADR-003 pull-on-arrival) | stale-round rejection, roster sanitization |

## CI

| Job | Mode | Gates merge? | Trigger |
|---|---|---|---|
| `e2e` (`ci.yml`) | local relay | Yes — in `ci-passed` | every PR / push to `main` |
| `e2e-real-world` (`e2e-real-world.yml`) | production Nostr | No | nightly + manual |

## Known gaps (accepted for now)

Surfaced by code review on PR #121, not yet fixed — listed here for visibility rather
than silently left in config comments:

- **Port collision across modes**: both modes serve the app on the same hardcoded
  `:4173` with `reuseExistingServer` on — running one mode then the other locally
  without killing the first `vite preview` silently reuses the wrong build.
- **Relay startup has no error handling**: a stale process already holding `:8971`
  makes `relay-server.mjs` fail with an unhandled rejection instead of a clear message.
- **`workers: 1` may be broader than necessary** — each spec uses a disjoint
  session-code room on the shared relay, so per-spec contention isn't obviously why all
  4 specs are serialized; untested whether parallel workers would actually work.
