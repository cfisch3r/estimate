# EstiMate documentation

`docs/domain/` and `docs/technical/` hold two different models of the same system, not two
depths of the same thing. **Domain** describes what EstiMate does — process, information
model, and rules — independent of how it's built. **Technical** describes how the domain
model is realized in code, and depends on it: every technical doc link points at a domain
doc or a sibling technical doc, never the reverse. [glossary.md](glossary.md) is shared
vocabulary used on both sides.

## Domain

| Doc | What it covers |
|---|---|
| [domain/prd.md](domain/prd.md) | Product requirements — problem, goals, non-goals, primary user & core flow, non-functional requirements, open questions, future phases. Links out to the four domain concepts below for process/model/rules/flow detail. |
| [domain/concepts/live-collaboration.md](domain/concepts/live-collaboration.md) | Domain concept: the Live and Manual mode processes, the Session/Item/Estimate/Participant/Roster information model, and the rules (privacy before reveal, no mid-session mode switch, late-join catch-up). |
| [domain/concepts/estimation-method.md](domain/concepts/estimation-method.md) | Domain concept: the three-point estimation process (aggregate, confidence interval, guard, finalize), the Estimate/AggregateResult/uncertainty-level information model, the final-result rule, and the bias-guard rules. |
| [domain/concepts/session-persistence.md](domain/concepts/session-persistence.md) | Domain concept: saving a session to a file and resuming it, the session-file information model, and the rules (unsaved-changes warning, no running round in the file, load only before a mode starts, whole-or-nothing restore, file naming). |
| [domain/concepts/screen-flow.md](domain/concepts/screen-flow.md) | Domain concept: the screen-flow diagram and per-screen content table for Mode selection, Workspace, Join Session, Participant Estimate View, and Session Summary. |

## Technical

| Doc | What it covers |
|---|---|
| [technical/architecture.md](technical/architecture.md) | Technical architecture in arc42 form — goals and constraints, the context view, the layer and component building-block views, runtime and deployment pointers, crosscutting concepts, quality goals, risks and debt. |
| [technical/architecture-rules.md](technical/architecture-rules.md) | The architecture rules and what enforces each; reviews and the architecture plugin's standard use the same names. |
| [technical/review-risk.md](technical/review-risk.md) | The review risk catalogue: named categories of change (domain math, live-session state, wire contract, weakened guardrails, and so on), the minimum risk each carries, and the fixed diff checks; one YAML block is read by `pnpm review:floor`. |
| [technical/adr/001-live-collaboration-architecture.md](technical/adr/001-live-collaboration-architecture.md) | Accepted decision: peer-to-peer WebRTC for Live mode, with Manual mode as a first-class fallback. |
| [technical/adr/002-testing-strategy.md](technical/adr/002-testing-strategy.md) | Accepted decision: layered tests — unit + component, plus a thin Playwright e2e layer since #26 (see ADR-007) — see the doc's 2026-09-07 and 2026-09-30 updates. |
| [technical/adr/003-session-reliability-model.md](technical/adr/003-session-reliability-model.md) | Accepted decision: facilitator-authoritative round state, versioned rounds, a values-free submission roster pulled on (re)connect, acknowledged submissions, stable client identity, role-asymmetric link state. The design anchor for #9, #60, #61, #62, #63 — stable client identity (#50), versioned rounds (#51), single owner (#60), acknowledged submissions (#61), and role-asymmetric link state (#62, narrowed scope) have all landed. |
| [technical/adr/004-feature-sliced-design-architecture.md](technical/adr/004-feature-sliced-design-architecture.md) | Accepted decision: Feature-Sliced Design (FSD) as the enforced architecture — the adopted layer set, the slice mapping, and the completed store-decomposition and advisory-metrics follow-ups. |
| [technical/adr/005-session-store-decomposition.md](technical/adr/005-session-store-decomposition.md) | Accepted decision: splitting `entities/session`'s monolithic store into three per-concern stores (session domain, live connection, round mechanics — navigation is out of scope, see ADR-006), with diagrams of the pre-decomposition and decomposed shapes and why round mechanics stays at the entities layer rather than moving into a features slice. |
| [technical/adr/006-router-adoption.md](technical/adr/006-router-adoption.md) | Accepted decision: replace the hand-rolled `currentScreen`/`goToScreen` navigation state with `react-router`, resolving an FSD layer-direction conflict ADR-005 hit while planning the store decomposition. |
| [technical/adr/007-e2e-dual-mode-signaling.md](technical/adr/007-e2e-dual-mode-signaling.md) | Accepted decision: Playwright e2e tests for the P2P layer, signaling via a locally self-hosted relay by default (blocking CI) and production Nostr relays in a separate nightly job. |
| [technical/adr/008-accessibility-testing-strategy.md](technical/adr/008-accessibility-testing-strategy.md) | Accepted decision: a three-layer automated accessibility stack (oxlint `jsx-a11y`, `jest-axe` component scans, real-browser `@axe-core/playwright` e2e scans), each riding an existing CI job, plus a deliberate, tracked `color-contrast` exclusion (#123) pending a Nocturne design-system token fix. |
| [technical/adr/009-architecture-style-fsd-vs-hexagonal-core.md](technical/adr/009-architecture-style-fsd-vs-hexagonal-core.md) | Accepted decision: keep FSD only for the UI and move the pure domain, the use cases and the transport/storage adapters into a hexagonal core with enforced inward-only dependencies, staged in three independently shippable steps; evidence from the 2026-10-05 architecture review. All stages are done (1, 2, 3a to 3d). |
| [technical/adr/010-spec-first-gherkin-specs.md](technical/adr/010-spec-first-gherkin-specs.md) | Accepted decision: a `specs/<concept>/<test level>/` tree of executable Gherkin specs (`playwright-bdd` for the `e2e` Test Level, `quickpickle` for the `domain` one since its 2026-11-13 update), dependency-cruiser rules keeping `e2e` driver code out of `src/` and `domain` driver code on `src/domain` only, and two asked-not-assumed workflow steps (an ephemeral design artifact before branching, a failing spec before planning) replacing the retired GitHub-Project-board task-picking algorithm. |
| [technical/concepts/collaboration-mode.md](technical/concepts/collaboration-mode.md) | Live mode (Mode A) technical concept, diagram-driven: the Trystero network layer, join flow, connection state machine, the participant estimate round, the facilitator reveal / retry-round flow, and the screen/store wiring shipped so far. Implements [domain/concepts/live-collaboration.md](domain/concepts/live-collaboration.md). |
| [technical/concepts/estimation-engine.md](technical/concepts/estimation-engine.md) | Estimation engine technical concept: one aggregation function for both modes, the self-validating `Estimate` value type, bias guards and the tunable constants. Implements [domain/concepts/estimation-method.md](domain/concepts/estimation-method.md). |
| [technical/concepts/e2e-testing.md](technical/concepts/e2e-testing.md) | E2E testing technical concept, diagram-driven: the Playwright/fixture/signaling component wiring, the two dual-mode build-and-run flows, the fixture-role model, the spec-to-wire-action coverage map, and the spec-first Gherkin scenarios under `specs/` (ADR-010). |
| [technical/runbook.md](technical/runbook.md) | Deployment & release runbook: the IONOS Deploy Now CD pipeline, secrets, troubleshooting, and versioning/release process. |

## Shared

| Doc | What it covers |
|---|---|
| [glossary.md](glossary.md) | Architecture vocabulary: layer, type, aggregate, entity, value object, inbound/outbound adapter, port, and the FSD-only terms slice and segment; the testing terms Test Level, stereotype and concept folder; with the words to avoid. |

## Specs

Executable Gherkin specs under `../specs/<concept>/<test level>/` are the acceptance
criteria for domain behaviour (ADR-010) — each domain concept doc above links to the specs
that cover it, where any exist yet.

Design references (dated snapshots, not living docs) live in `../design_handoff_estimate_app/` and `../design_handoffs/`.
