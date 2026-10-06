# ADR-009: Architecture Style — FSD Everywhere vs. a Hexagonal Core with an FSD UI

**Status:** Proposed
**Date:** 2026-10-06
**Related:** [004-feature-sliced-design-architecture.md](004-feature-sliced-design-architecture.md), [005-session-store-decomposition.md](005-session-store-decomposition.md), [003-session-reliability-model.md](003-session-reliability-model.md), [001-live-collaboration-architecture.md](001-live-collaboration-architecture.md), [006-router-adoption.md](006-router-adoption.md), [007-e2e-dual-mode-signaling.md](007-e2e-dual-mode-signaling.md)

> This ADR proposes; it moves no code and changes no enforcement. ADR-004 stays in
> force until this one is accepted. If accepted, ADR-004 is superseded **for the
> non-UI part of `src/`** only, and each stage below would be its own change, open to
> revisiting once it lands.

## Context

ADR-004 adopted Feature-Sliced Design (FSD) for the whole of `src/`. A full
architecture review of the repo on 2026-10-05 (three parallel `architecture-review`
passes, plus a follow-up review of the fixes) found about 29 judgment-call issues
that Steiger and oxlint cannot see. The review report itself was not kept in the
repo; the table below records the patterns it found. Most of them cluster around
the same few causes rather than being independent mistakes:

| Cause | Evidence from the review |
|---|---|
| **Domain rules living in the wrong place** because FSD gives them no home of their own | Cone-of-uncertainty math re-implemented in a feature hook; the "who is in the round" rule written twice on two layers; the finalize rule duplicated across two features; `NetworkProvider` (transport) also holding snapshot, resend and prune policies |
| **Entity slices that are really one concept**, forcing cross-slice imports | `entities/participant` and `entities/estimate` were each only used by `entities/session`; the `@x` cross-import surface was added and then removed again once they were folded in |
| **A rule that cannot be enforced with the layer model** | Steiger's `forbidden-imports` rule was switched off for `entities/session/{model,api}` so they could import `estimate` and `participant`; that also silenced its upward-import check for the most central files. The exemption has since been removed, but only because the slices were folded together |
| **Segment semantics that FSD leaves open** | Stateful hooks in `lib/` vs. `model/`; wire parsing in `api/`; storage I/O in `model/` vs. `api/` vs. `lib/` |
| **Use-case logic with no layer** | Estimation/validation inside store actions; teardown and join composition arguably belonging to neither entity nor feature |

All of these were fixed inside FSD (the 2026-10-05/06 refactor and its review follow-ups), at the cost of
folding both extra entity slices into `entities/session` and keeping the pure
estimation core as a convention-only subfolder (`model/estimate/`) that Steiger
cannot enforce.

### What the app is

The PRD describes a product whose weight is not in its UI composition:

| Requirement (PRD) | Implication |
|---|---|
| Two session modes on one domain: live (P2P) and manual (§4.1) | One domain core with two drivers |
| Serverless P2P with graceful degradation (§9, ADR-001, ADR-003) | The transport is infrastructure with real logic, and is already swapped in tests (ADR-007) |
| Persistence, CSV export, shareable link (§2, §9; not built) | More adapters around the same core |
| Bias guards and three-point calculations (§5, §6) | The pure, heavily tested part is the product's value |
| Future phases: story points, T-shirt sizing, backlog import (§12) | Several estimation methods over shared session/item machinery, plus import adapters |

FSD is designed for the UI-composition problem (pages made of widgets made of
features made of entities). This app has a small pure domain, a substantial
protocol/reliability layer and a thin UI. FSD maps well onto the third and badly onto
the first two.

## Options considered

| Option | Idea | Fit | Main cost |
|---|---|---|---|
| **A. Stay with FSD everywhere** (status quo, after the 2026-10-05/06 refactor) | Keep one architecture; fix findings as they appear | No migration; tooling and docs already match | The causes above recur: the domain core has no enforced boundary, and protocol logic has no layer |
| **B. Hexagonal everywhere** | `domain` / `application` / `adapters` / `ui`, dependencies pointing inward only | Best match for the core and the protocol; both modes become two callers of the same use cases; persistence/export become new adapters | Layers are by technical role, so a UI feature's code spreads across several folders; loses FSD's UI composition rules |
| **C. Hybrid: hexagonal core, FSD for the UI** | B for everything non-visual; FSD (`app/pages/widgets/features/shared`) only for the UI | Each part gets the style that fits it; future estimation methods remain vertical UI features over a shared core | Two conventions to learn; a boundary between them to police |
| **D. Explicit state machine for the round** (orthogonal to A–C) | Model collecting / revealed / retry / finalized plus reconnect rules as a transition table or reducer; effects at the edge | The round is already a state machine in ADR-003; transitions become testable without a network | A different way of writing state; scope is the protocol, not the layout |
| **E. Package-by-feature, no strict layers** | Vertical slices plus a small shared kernel | Most flexible | No mechanical enforcement; gives up what Steiger provides today |

## Decision

**Adopt C (hexagonal core, FSD UI), staged so that each stage is independently
valuable and can be stopped after.** Treat D as a separate follow-up decision about
how the round is written, not part of this one.

Target shape (a sketch: the UI lane is simplified, and edges point from the
depending lane to the one it imports from).

Legend: solid arrow = import dependency; dotted arrow = I/O to an external system;
dashed box = external system.

```mermaid
flowchart LR
  subgraph UI["UI (FSD)"]
    direction TB
    Pages["Pages and widgets<br/>[React Components]"]
    Features["Features<br/>[React Components and hooks]"]
  end
  subgraph APP["APPLICATION"]
    direction TB
    UseCases["Use cases<br/>[Hooks and Zustand stores]"]
  end
  subgraph DOM["DOMAIN"]
    direction TB
    Core["Estimate and session rules<br/>[Pure functions and value types]"]
  end
  subgraph AD["ADAPTERS"]
    direction TB
    Net["Network and wire parsing<br/>[Trystero adapter]"]
    Store["Storage, export, import<br/>[Browser and file adapters]"]
  end
  Ext["Peers, relays, browser storage<br/>[External systems]"]
  Pages -->|composes| Features
  Features -->|calls| UseCases
  Features -->|types and display rules| Core
  UseCases -->|rules and value types| Core
  Net -->|dispatches into| UseCases
  Store -->|loads and saves through| UseCases
  Net -->|validates with| Core
  Store -->|serialises with| Core
  AD -.->|WebRTC, relays, file and browser storage I/O| Ext
  style UI fill:#dbe6ff,stroke:#3d56a6,stroke-width:2px,color:#14171f
  style APP fill:#d3eddb,stroke:#2f7a43,stroke-width:2px,color:#14171f
  style DOM fill:#fbe9bf,stroke:#9a6f1e,stroke-width:2px,color:#14171f
  style AD fill:#ecd8f1,stroke:#7a3d8c,stroke-width:2px,color:#14171f
  classDef ui fill:#b9ccf7,stroke:#3d56a6,color:#14171f
  classDef app fill:#b2dfc0,stroke:#2f7a43,color:#14171f
  classDef dom fill:#f6d891,stroke:#9a6f1e,color:#14171f
  classDef ad fill:#dcbfe5,stroke:#7a3d8c,color:#14171f
  classDef ext fill:#ffffff,stroke:#555555,color:#14171f,stroke-dasharray: 5 5
  class Pages,Features ui
  class UseCases app
  class Core dom
  class Net,Store ad
  class Ext ext
```

| Box | Lane | Responsibility |
|---|---|---|
| **Estimate and session rules** | Domain | Everything pure: `Estimate` and its factory, aggregation, guards, uncertainty guidance, item and round types, roster, snapshot and resend policies, label rules, the finalize rule. No React, no I/O. Keeps the 100% coverage threshold. |
| **Use cases** | Application | Submit, reveal, retry, finalize, join and leave, and the stores they write to (including the connection store). Replaces today's use-case hooks in `features/` and the stores in `entities/session/model`. |
| **Network and wire parsing** | Adapters | The Trystero/WebRTC transport, signaling, and validation of untrusted peer messages into domain values. Calls the use cases when a peer message arrives. |
| **Storage, export, import** | Adapters | Participant-identity storage today; future save/load, CSV and link export, and backlog import. |
| **Features** | UI | UI-only features and their components. They call use cases; they no longer own them. |
| **Pages and widgets** | UI | Screens and widgets composed from features and shared UI, plus routing (ADR-006) and the design system. |
| **Peers, relays, browser storage** | External | Not part of the codebase. |

### Staging

1. **Extract the domain.** Move `entities/session/model/estimate/` and the other pure
   modules (`item`, `types`, `participantId`, `participantLabel`, `roster`, `snapshot`,
   `resend`, `finalResult`) into a `domain/` folder with an enforced "imports nothing
   outside `domain/`" rule. This alone removes the weakest point left after the
   2026-10-05/06 refactor (a convention-only boundary).
2. **Extract the adapters.** Move `entities/session/api/` (transport, wire parsing,
   signaling) and the participant-identity helper into `adapters/`.
   `NetworkProvider` becomes the composition point that wires an adapter to the use
   cases. One catch: `model/connection.ts` currently imports the identity helper,
   so the use case would depend on an adapter, which contradicts the diagram. The
   identity would have to be passed in (a port) or created at the composition point.
3. **Extract the application layer.** Move the stores and use-case hooks into
   `application/`. The FSD `features` layer keeps only UI.

Each stage ends with all CI checks green and can be the last one.

### Enforcement

Steiger can keep checking the UI part, but it cannot express "domain imports
nothing" or "adapters depend inward only". Those rules need a different checker.
Candidates are oxlint's `no-restricted-imports` (not enabled in `.oxlintrc.json`
today) or a dedicated dependency-boundary tool. Choosing the tool is part of stage 1
and is not decided here.

## Consequences

**Positive**

- The domain core gets a boundary that tooling can enforce instead of a convention.
- The estimate-vs-session and entity-vs-feature questions that cost time in the
  review disappear for the non-UI code.
- Protocol and reliability logic (ADR-003) gets a home; it stops accumulating in the
  transport adapter or in feature hooks.
- Save/load, export and import fit as additional adapters without touching the core.
- The UI keeps what FSD does well, and future estimation methods stay vertical UI
  features over one shared core.

**Negative**

- A real migration, in three stages, touching most files; ADR-004, ADR-005, the
  `fsd-architecture` skill, `AGENTS.md`, the review agents and the Steiger config all
  need updating.
- Two conventions in one repo, with a boundary to maintain.
- Features today bundle a use case and its UI; separating them means a UI feature
  and its use case live in different folders.
- Losing Steiger's coverage of the non-UI code in exchange for a different enforcement
  mechanism.

## Open questions

- Where should stores live: in `application/` with the use cases, or in `domain/`
  as state holders? (Today's stores contain both.)
- Can Steiger be scoped to the UI folder only, and does it still require an
  `entities` layer there for UI-only entity components (for example `RangeBar`)?
- Should the round be written as an explicit state machine (option D), and with a
  library or a hand-rolled reducer? This is a separate decision.
- Folder names and whether `domain` needs internal sub-structure per concept.
- How the connection store gets the participant identity without depending on an
  adapter (see stage 2).
