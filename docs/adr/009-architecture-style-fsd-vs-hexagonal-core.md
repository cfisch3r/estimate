# ADR-009: Architecture Style — FSD Everywhere vs. a Hexagonal Core with an FSD UI

**Status:** Accepted (2026-10-08); stages 1, 2, 3a, 3b and 3c done, 3d pending
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
| Two session modes on one domain: live (P2P) and manual (§4.1) | One domain core with two entry points |
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

Target structure, in two views. Features and adapters may also use domain types directly;
those edges are left out to keep the diagrams readable. In the layer view the arrow from the
UI to the application layer stands for both of its uses: calling use cases and reading the
stores; the component view shows the two separately.

**Layer view: what depends on what.**

Legend: solid arrow = calls (the arrow points at the callee; a double arrow goes both
ways). When the callee is an adapter, the call goes through an interface that the
application layer owns, so the source-code dependency still points inward. Dashed amber
arrow = the adapter implements that interface, wired in at composition time. Dashed box =
external system.

```mermaid
%%{init: {"flowchart": {"nodeSpacing": 80, "rankSpacing": 150, "padding": 14}}}%%
flowchart LR
  UI["UI (FSD)<br/>[Pages, widgets, features]"]
  APP["APPLICATION<br/>[Use cases, state stores]"]
  DOM["DOMAIN<br/>[Pure rules and value types]"]
  AD["ADAPTERS<br/>[Network, storage, export]"]
  Ext["Peers, relays, browser storage<br/>[External systems]"]
  UI -->|calls| APP
  APP -->|uses rules| DOM
  APP <-->|peer messages in,<br/>calls out via ports| AD
  AD -.->|implements ports| APP
  AD <-->|I/O| Ext
  linkStyle 3 stroke:#d98a1c,stroke-width:3px,stroke-dasharray:7 5
  classDef ui fill:#dbe6ff,stroke:#3d56a6,stroke-width:2px,color:#14171f
  classDef app fill:#d3eddb,stroke:#2f7a43,stroke-width:2px,color:#14171f
  classDef dom fill:#fbe9bf,stroke:#9a6f1e,stroke-width:2px,color:#14171f
  classDef ad fill:#ecd8f1,stroke:#7a3d8c,stroke-width:2px,color:#14171f
  classDef ext fill:#ffffff,stroke:#555555,color:#14171f,stroke-dasharray: 5 5
  class UI ui
  class APP app
  class DOM dom
  class AD ad
  class Ext ext
```

**Component view: what is inside each layer.**

Legend: same notation as above. The ports and the "implements" relationship appear in the
layer view only.

```mermaid
%%{init: {"flowchart": {"nodeSpacing": 70, "rankSpacing": 90, "padding": 14}}}%%
flowchart LR
  subgraph UI["UI (FSD)"]
    direction TB
    Pages["Pages and widgets<br/>[React Components]"]
    Features["Features<br/>[React Components and hooks]"]
  end
  subgraph APP["APPLICATION"]
    direction TB
    UseCases["Use cases<br/>[Hooks]"]
    Stores["State stores<br/>[Zustand stores]"]
  end
  subgraph AD["ADAPTERS"]
    direction TB
    Net["Network and wire parsing<br/>[Trystero adapter]"]
    Store["Storage and export<br/>[Browser and file adapters]"]
  end
  subgraph DOM["DOMAIN"]
    direction TB
    Core["Estimate and session rules<br/>[Pure functions and value types]"]
  end
  Ext["Peers, relays, browser storage<br/>[External systems]"]
  Pages -->|composes| Features
  Features -->|calls| UseCases
  Pages & Features -->|reads state,<br/>trivial setters| Stores
  UseCases -->|uses rules| Core
  UseCases -->|reads and writes| Stores
  UseCases <-->|peer messages in,<br/>calls out via port| Net
  UseCases -->|saves via port| Store
  Net -->|reads state for<br/>snapshot broadcast| Stores
  Net <-->|WebRTC, relays| Ext
  Store <-->|files, browser storage| Ext
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
  class UseCases,Stores app
  class Core dom
  class Net,Store ad
  class Ext ext
```

| Box | Layer | Responsibility |
|---|---|---|
| **Estimate and session rules** | Domain | Everything pure: `Estimate` and its factory, aggregation, guards, uncertainty guidance, item and round types, roster, snapshot and resend policies, label rules, the finalize rule. No React, no I/O. Keeps the 100% coverage threshold. |
| **Use cases** | Application | Submit, reveal, retry, finalize, join and leave, written as straight-line code: read state, call a domain decision, write state, trigger an effect. Owns the interfaces (ports) that adapters implement, such as the peer transport (`ports/outbound/networkTransport.ts`, since stage 3c). Replaces the use-case hooks that were in `features/` (stage 3a: now `src/application/useCases`; `features/` keeps thin navigation wrappers). |
| **State stores** | Application | The Zustand stores holding the current session, round and connection state (see "Where state lives"). Lives in `src/application/stores` (stage 3a). The UI reads them directly with selectors and may call a few trivial field setters (session name, unit, item selection and text fields); every other write goes through a use case (stage 3b-2). |
| **Network and wire parsing** | Adapters | The Trystero/WebRTC transport, signaling, and validation of untrusted peer messages into domain values. Calls the use cases when a peer message arrives, broadcasts the facilitator's snapshot when the stores change, and implements the peer-transport port the use cases send through. |
| **Storage and export** | Adapters | Participant-identity storage today; future save/load and CSV and link export. Called by the application through the storage port it implements (an outbound adapter). An import adapter (backlog import, a later phase) would be a separate inbound adapter that calls the use cases, added when that phase is designed. |
| **Features** | UI | UI-only features and their components. They call use cases; they no longer own them. |
| **Pages and widgets** | UI | Screens and widgets composed from features and shared UI, plus routing (ADR-006) and the design system. |
| **Peers, relays, browser storage** | External | Not part of the codebase. |

### Where state lives

State types and state transitions are separated from the thing that holds the
current state:

| Layer | Holds | Example |
|---|---|---|
| Domain | The state **types** and the **pure transitions** over them, as `(state, event) -> new state` | `Item`, `LiveRound`, reveal and retry of a round, versioned-round rule (ADR-003), applying a snapshot, `finalResultFor` |
| Application | The Zustand **stores** that hold the current state, and the use cases that operate on them | the session, round and connection stores; submit, reveal, finalize |
| UI | Short-lived state belonging to one component | the estimate draft, the selected phase, whether a popover is open |

**This layer is not stateless, unlike textbook hexagonal architecture.** A browser app
has one long-lived, in-process state with one implementation, so a port in front of it
would add ceremony and nothing to swap. Keeping the stores in the application layer
needs no exception to the inward-only dependency rule, because nothing outward is
imported. What it gives up is the textbook claim that the application layer holds no
state.

**Ports exist only at external boundaries.** The peer transport already has one:
`NetworkSessionApi` is an interface that the use cases depend on and React context
injects, and the test relay (ADR-007) is a second implementation behind the signaling
contract. In the hybrid, the interface is owned by the application layer and the
Trystero adapter implements it (the dashed edge in the diagram). The same pattern fits
the storage adapter later. Inbound adapters, such as incoming peer
messages, call the use cases directly and need no port. The network adapter also reads
state by subscribing to the stores to broadcast the facilitator's snapshot, which is an
inward dependency and needs no port either.

**Use cases are straight-line.** Because they call the stores directly, they are tested
against the real stores (as the hook tests do today), not against fakes. That is only
acceptable if they contain no rules: any `if` that expresses a business rule moves into a
pure domain function with full branch coverage. A review of the 2026-10-05 refactor
found a real bug in exactly such a hook (a stale read of the round at call time), so
this has to be kept true rather than assumed. The `architecture-review` pass should
check it.

Zustand stays out of the domain so that the domain's "no framework, no I/O" rule stays
literal. The four stores (`session`, `round`, `connection`, `publicStores`) are the
only files in `src/application/stores` that import a package; the pure modules that
used to sit beside them now live in `src/domain/` (stage 1) and import only each other (stage 2 removed the connection store's one adapter import, the identity helper: the store now receives the id as an argument), which supports the split. The connection store holds state about
the link, not about the estimate; it is written mostly by the network adapter, with its
pure rules (for example which departed participants to prune) in the domain. The
facilitator remains the authority (ADR-003): their store holds the full round state and
participants hold a derived snapshot; both are domain types.

Moving the transition logic out of the stores' `set(...)` calls is the riskiest part of
stage 3, and most store tests would be rewritten against the pure functions. It also
makes option D (an explicit state machine) a small step later, since the transitions are
already pure functions of state and event.

### Staging

1. **Extract the domain (done).** Move `entities/session/model/estimate/` and the other pure
   modules (`item`, `types`, `participantId`, `participantLabel`, `roster`, `snapshot`,
   `resend`, `finalResult`) into a `src/domain/` folder with an enforced "imports nothing
   outside `domain/`" rule. This alone removes the weakest point left after the
   2026-10-05/06 refactor (a convention-only boundary).
2. **Extract the adapters (done).** Move `entities/session/api/` (transport, wire parsing,
   signaling) and the participant-identity helper into `adapters/`.
   `NetworkProvider` becomes the composition point that wires an adapter to the use
   cases. One catch: `model/connection.ts` currently imports the identity helper,
   so the use case would depend on an adapter, which contradicts the diagram. The
   identity would have to be passed in (a port) or created at the composition point.
   As built: the wire files went to `src/adapters/network/` and the identity helper to
   `src/adapters/storage/`. The join use case (`useJoinLiveSession`) reads the id through an
   application-owned identity port (`ParticipantIdentityApi`, provided in `app/App.tsx`) and
   passes it to `joinLiveSession` as an argument, so the store imports no adapter.
   `ConnectionStatus` moved into `src/domain/types.ts` because both the adapter and the
   store need it. `NetworkProvider`, the `NetworkSessionApi` port, `retryPolicy` and
   `sessionCode` stayed in `entities/session/api` until stage 3a moved them to `src/application`.
   In stage 3a `NetworkProvider` still imported the network adapter, so the oxlint rule carried
   one named exception for it; stage 3c removed it.
3. **Extract the application layer (in progress).** Move the stores and use-case hooks into
   `application/`. The FSD `features` layer keeps only UI. Sub-steps: 3a moves the code
   (done); 3b-1 moves the store rules into the domain (done); 3b-2 narrows the UI-visible store types and adds `useItemActions` (done); 3c splits `NetworkProvider` (done); 3d (cleanup: the fate of the
   UI-only `entities/session` slice, the `ConnectionStatus` types next to the transport
   port) is pending.
   As built in 3a: `src/application/` holds `stores/` (`session`, `round`, `connection`,
   `publicStores`, and `index.ts`, which the use cases import), `ports/`
   (`NetworkSessionApi` and `ParticipantIdentityApi` with their React contexts and hooks),
   `useCases/` (join, teardown, reconnect, start collaborative, start single-user, close
   workspace, reveal actions, submit estimate, finalize estimate, plus `retryPolicy` and
   `sessionCode`, each beside its only consumer) and `NetworkProvider.tsx`, which still held the connect, resend, pull,
   prune and broadcast logic (split in 3c). `src/application/index.ts` is the layer's barrel and the only
   thing the UI imports from it. The use cases contain no navigation: `features/session-lifecycle`
   keeps thin wrappers that add it (`useStartCollaborative`, `useStartSingleUser`,
   `useLeaveWorkspace`, `useLeaveLiveSession`) plus the UI flow `useJoinFlow`, and
   `features/reveal-results`' `useRevealRound` is the labelled roster view plus `useRevealActions`.
   `entities/session` now holds only UI (`ItemDetailShell`, `EstimateTriple`, `RangeBar`,
   `DescriptionField`) and its barrel exports only the first three; UI code imports
   domain symbols from `src/domain` directly. Enforcement as built: an oxlint override on
   `src/application/**` lets it import the domain and itself only (no FSD layers, no
   adapters), with a second override naming `NetworkProvider.tsx` and its test as the one
   temporary exception allowed to import `adapters/network/session` and
   `adapters/network/connection` (removed in 3c). The adapters rule and the "only `app/` composes adapters" rule
   are unchanged. A guard test, `src/viMockPaths.test.ts`, fails when a relative `vi.mock`
   target does not resolve, so a moved module cannot leave a mock pointing at a file that no longer exists (it does not detect a mock of a module the code under test stopped importing).

   As built in 3b-1: the rules that sat inside the stores' `set(...)` calls and in
   `NetworkProvider` are pure functions in `src/domain/`, and the stores only hold state
   and call them. `connection.ts` has `deriveConnectionStatus` (moved out of
   `NetworkProvider`), `normalizeSessionCode`, `facilitatorStart`, `participantJoin`,
   `withConnectionStatus` (with the `hasEverConnected` latch) and `leavingNeedsConfirm`.
   `item.ts` gained `firstPendingItemId`, `appendItem`, `removeItemFrom`, `moveItem` and
   `updateItem`. `round.ts` has `upsertByParticipant`, `retryRoundPatch`,
   `acceptRemoteEstimate` (the ADR-003 drop rules), `recordOwnSubmission`, `adoptSnapshot`
   (versioned rounds, reveal-gated submissions, `mySubmission` carry-over); `snapshot.ts`
   gained `sessionFieldsFromSnapshot`. `delivery.ts` holds the `DeliveryState` type and
   `deliveryStateFor` (called by `useSubmitEstimate`; the UI imports the `DeliveryState` type from `src/domain/delivery`), `navigation.ts`
   holds `advanceFrom` and `previousItemId`, and `participantId.ts` gained
   `LOCAL_PARTICIPANT_ID`. Two application additions: `useCases/applyFacilitatorSnapshot.ts`
   (not a hook; writes the session name and unit, then the round view) and
   `useCases/finalizeWith.ts` (the finalize step shared by `finalizeEstimate` and
   `useRevealActions`). The round store no longer reads the connection store, so the
   store import cycle risk noted in ADR-005 is gone.

   As built in 3b-2: the UI-access rule (decided 2026-10-08). The UI may read store state
   with selectors and may call the trivial field setters directly (`setSessionName`,
   `setUnit`, `selectItem`, `setItemTitle`, `setItemNotes`, `setItemDescription`). Every
   write that carries a rule goes through a use case: `useItemActions` (add, remove,
   reorder) joins `useRevealActions`, `useJoinLiveSession`, `useCloseWorkspace` and the
   rest. `stores/publicStores.ts` now gives the UI explicit, read-only, state-only views plus
   those setters for all three stores (selectors, `getState` and `subscribe`, no `setState`),
   so calling any other action, or writing state around the use cases, is a compile error
   (pinned by exact-key type tests). Tests that seed state import the full stores from
   `application/testing`, which the lint rule allows in test files only, and the barrel-only lint rule keeps the UI from importing
   the full stores that use cases and `NetworkProvider` use (`stores/index.ts`). The
   stores are not moved into the UI: the network code and the use cases write them too,
   so a UI-owned store would have forced a storage port. The round store's
   `applySyncState` became `applyRoundSnapshot`, since it adopts only the round part of a
   snapshot (`applyFacilitatorSnapshot` applies the whole thing); the title rule behind `setItemTitle` is now the domain's `renameItem` (a blank title is ignored, as for a new item, so an item cannot lose its name — the one small behaviour change in this stage); the dead `setMode` was
   removed.

   As built in 3c: `application/ports/outbound/networkTransport.ts` defines `TransportSession`,
   `ConnectionState` and `JoinSession` (no React; `ParticipantAnnounce` is a domain type in
   `domain/types.ts`, since `announcementFor` builds it); `adapters/network` implements it
   and imports these types, and the lint rule lets adapters import only the
   `application/ports/outbound/` folder, where React-free ports for external systems live
   (the React contexts stay in `ports/`). `application/useCases/liveSessionController.ts` exports
   `createLiveSessionController({ joinSession })`, returning `{ api, dispose }`; it holds
   what `NetworkProvider` used to (connect, disconnect, `sendEstimate` with retry, resend,
   snapshot pull, roster prune, announce, facilitator broadcast) and is tested without React
   against a fake transport. `src/app/NetworkProvider.tsx` is a ~25-line shell that wires
   `adapters/network`'s `joinSession` into the controller and provides
   `NetworkSessionContext`; the application barrel no longer exports `NetworkProvider` or the controller: those, with
   `NetworkSessionContext` and the port types the shell needs, come from a separate
   `application/composition.ts` entry that the lint rule allows in `src/app` and in test
   files only. The identity port's context and the `useNetworkSession` / `useParticipantIdentity`
   hooks moved there too: no UI code outside `application` used them, only the composition
   root and tests that provide them. The
   temporary oxlint exception is gone: `application` imports no adapter at all. Three small
   predicates moved into the domain: `shouldBroadcastSnapshot` and `announcementFor`
   (`domain/connection.ts`) and `roundKey` (`domain/resend.ts`).

Each stage ends with all CI checks green and can be the last one.

### Enforcement

Both enforcement questions were checked in a throwaway copy of the repo before this
ADR was proposed, using the installed Steiger 0.7.0 with `@feature-sliced/steiger-plugin` 0.8.0 and oxlint 1.78.0.

**FSD for the UI only (Steiger).** Running `steiger ./<ui-folder>` on a folder that
contains only `app`, `pages`, `widgets`, `features` and `shared` works as needed:
it reports `fsd/forbidden-imports` for both an upward import and a sibling-slice
import, the `entities` layer is optional (a tree without it passes), and files outside
the given root are not checked at all. So Steiger can keep guarding the UI after the
split, and it will not see imports that leave the UI folder (see below).

**Domain and application boundaries (oxlint `no-restricted-imports`).** A per-folder
override in `.oxlintrc.json` can express the rules, with these properties:

- It flagged imports of outer layers (`../ui/**`, `../adapters/**`, `../application/**`
  from `domain/`; `ui` and `adapters` from `application/`), imports of any package
  from `domain/` (including ones never listed, such as a newly added library), and
  left in-domain relative imports alone, including nested ones.
- The package allow-list and the outer-layer ban must be in **one** `patterns` group,
  with the negations (`!./**`, `!../**`) before the outer-layer patterns. Two separate
  groups interfere: the wider negation cancelled the outer-layer ban. This is
  gitignore-style last-match-wins ordering.
- As built in stage 1 the group is `["**", "!./**", ...]` with a re-ban for specifiers that climb out (`./../**`) and, in subfolders, `!../*` (a sibling at the domain root) followed by `../../**`. `no-restricted-globals` also bans I/O globals (`window`, `fetch`, `localStorage`, ...). `vitest` is allowed only in test files and fixtures.
- The patterns are path-based, so they depend on the repo using relative imports (it
  does; there are no path aliases). Introducing an alias would require adding it to
  the patterns.
- It cannot tell a use case from an adapter by what it imports, only by folder, so the
  folder layout is what carries the rule.

Imports from the UI into `application/` or `domain/` leave Steiger's root and are
therefore not checked by it; they are allowed by design, and the reverse direction
is covered by the oxlint rule above. A dedicated dependency-boundary tool is not
needed for these rules.

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

## Questions settled here and questions deferred

| Question | Status |
|---|---|
| Where do the stores live? | Settled: application layer; types and transitions in the domain (see "Where state lives") |
| Can Steiger be scoped to the UI folder, and is an `entities` layer required there? | Settled by a check: yes, and no (see "Enforcement") |
| Can the domain and adapter boundaries be enforced with current tooling? | Settled by a check: yes, with oxlint (see "Enforcement") |
| Should the round be an explicit state machine, and with what? | Deferred to a separate decision; the pure transitions from stage 3 are its prerequisite |
| How does the connection store get the participant identity without depending on an adapter? | Settled in stage 2: the join use case reads it through an application-owned port, provided in `app/App.tsx`, and passes it to the store as an argument |
| Folder names and the domain's internal structure per concept | Settled in stage 1: a flat `src/domain/` with an `estimate/` subfolder; adapters settled in stage 2 as `adapters/network` and `adapters/storage`; the application layer's folder settled in stage 3a as `src/application` with `stores`, `ports` and `useCases` |
