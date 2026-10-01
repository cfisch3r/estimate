# EstiMate documentation

| Doc | What it covers |
|---|---|
| [prd.md](prd.md) | Product requirements — problem, goals, session modes, calculations, bias guards, screens, data model, phased roadmap. |
| [architecture.md](architecture.md) | Technical architecture — stack, module structure, the estimation engine, the P2P network layer, persistence approach, hosting. |
| [adr/001-live-collaboration-architecture.md](adr/001-live-collaboration-architecture.md) | Accepted decision: peer-to-peer WebRTC for Live mode, with Manual mode as a first-class fallback. |
| [adr/002-testing-strategy.md](adr/002-testing-strategy.md) | Accepted decision: layered tests — unit + component, plus a thin Playwright e2e layer since #26 (see ADR-007) — see the doc's 2026-09-07 and 2026-09-30 updates. |
| [adr/003-session-reliability-model.md](adr/003-session-reliability-model.md) | Accepted decision: facilitator-authoritative round state, versioned rounds, a values-free submission roster pulled on (re)connect, acknowledged submissions, stable client identity, role-asymmetric link state. The design anchor for #9, #60, #61, #62, #63 — stable client identity (#50), versioned rounds (#51), single owner (#60), acknowledged submissions (#61), and role-asymmetric link state (#62, narrowed scope) have all landed. |
| [adr/004-feature-sliced-design-architecture.md](adr/004-feature-sliced-design-architecture.md) | Accepted decision: Feature-Sliced Design (FSD) as the enforced architecture — the adopted layer set, the slice mapping, and the completed store-decomposition and advisory-metrics follow-ups. |
| [adr/005-session-store-decomposition.md](adr/005-session-store-decomposition.md) | Accepted decision: splitting `entities/session`'s monolithic store into three per-concern stores (session domain, live connection, round mechanics — navigation is out of scope, see ADR-006), with diagrams of the pre-decomposition and decomposed shapes and why round mechanics stays at the entities layer rather than moving into a features slice. |
| [adr/006-router-adoption.md](adr/006-router-adoption.md) | Accepted decision: replace the hand-rolled `currentScreen`/`goToScreen` navigation state with `react-router`, resolving an FSD layer-direction conflict ADR-005 hit while planning the store decomposition. |
| [adr/007-e2e-dual-mode-signaling.md](adr/007-e2e-dual-mode-signaling.md) | Accepted decision: Playwright e2e tests for the P2P layer, signaling via a locally self-hosted relay by default (blocking CI) and production Nostr relays in a separate nightly job. |
| [adr/008-accessibility-testing-strategy.md](adr/008-accessibility-testing-strategy.md) | Accepted decision: a three-layer automated accessibility stack (oxlint `jsx-a11y`, `jest-axe` component scans, real-browser `@axe-core/playwright` e2e scans), each riding an existing CI job, plus a deliberate, tracked `color-contrast` exclusion (#123) pending a Nocturne design-system token fix. |
| [concepts/collaboration-mode.md](concepts/collaboration-mode.md) | Live mode (Mode A) technical concept, diagram-driven: the Trystero network layer, join flow, connection state machine, the participant estimate round, the facilitator reveal / retry-round flow, and the screen/store wiring shipped so far. |
| [concepts/e2e-testing.md](concepts/e2e-testing.md) | E2E testing technical concept, diagram-driven: the Playwright/fixture/signaling component wiring, the two dual-mode build-and-run flows, the fixture-role model, and the spec-to-wire-action coverage map. |
| [runbook.md](runbook.md) | Deployment & release runbook: the IONOS Deploy Now CD pipeline, secrets, troubleshooting, and versioning/release process. |

Design references (dated snapshots, not living docs) live in `../design_handoff_estimate_app/` and `../design_handoffs/`.
