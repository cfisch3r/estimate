# ADR-005: Decomposing `entities/session`'s Monolithic Store

**Status:** Accepted
**Date:** 2026-09-29
**Related:** [004-feature-sliced-design-architecture.md](004-feature-sliced-design-architecture.md), [006-router-adoption.md](006-router-adoption.md), issue #111

> **Update 2026-10-08:** ADR-009 stage 3 moved the stores to `src/application/stores` and the UI now sees
> read-only, state-only views of them; the round store's `applySyncState` is now `applyRoundSnapshot`,
> and the dead `setMode` action was removed. The text below is left as the original record.
>
> **Update 2026-10-05:** the round store no longer validates or aggregates. `finalizeLiveItem` was removed and `finalizeItem(id, result)` now takes an already-computed `AggregateResult`; `submitEstimate(estimate)` and `applyRemoteEstimate` take an already-valid `Estimate`, and `applySyncState` takes `Estimate[]` submissions (the wire layer validates them). `createEstimate` / `aggregateEstimates` are composed by `features/submit-estimate`, `features/reveal-results` and `features/estimate-round`. `finalResultFor` (`entities/session/model/finalResult.ts`) is the single finalize rule, and both finalize paths return the shared `ActionResult`. The slice's public API exports `useConnectionStore` / `useRoundStore` as narrowed views (`model/publicStores.ts`) without the bridge-only mutators (`setMode`, `setConnectionStatus`, `setPeerCount`, `applyParticipantName`, `removeParticipant`, `applySyncState`, `applyRemoteEstimate`); `NetworkProvider` writes through the internal stores. The action lists below record the original decomposition, and the diagrams are updated to the current actions and hooks.

## Context

`entities/session/model/store.ts` (486 lines) moved into its FSD home unchanged
during the ADR-004 migration — decomposing it was deliberately deferred as its
own piece of design work (see ADR-004, "Migration is staged into three
pieces", item 2).

The store mixed four concerns behind one `useSessionStore` hook. The first —
app navigation (`currentScreen`/`goToScreen`) — is **no longer part of this
decomposition**: attempting to give it an FSD-compliant home surfaced a real
layer-direction conflict, resolved instead by replacing it with a real router
before this split happens (see ADR-006). What's left is three concerns:

| # | Concern | State | Actions |
|---|---|---|---|
| 1 | Session domain data | `sessionName`, `unit`, `items`, `activeItemId` | `setSessionName`, `setUnit`, `addItem`, `setItemTitle`, `removeItem`, `reorderItems`, `selectItem`, `setItemNotes`, `setItemDescription` |
| 2 | Live-connection state | `mode`, `role`, `sessionId`, `myName`, `participantId`, `connectionStatus`, `hasEverConnected`, `peerCount`, `participantNames` | `setMode`, `setConnectionStatus`, `setPeerCount`, `applyParticipantName`, `removeParticipant`, `startCollaborative`, `joinLiveSession`, `leaveLiveSession` |
| 3 | Round mechanics | `liveRound` | `finalizeItem`, `finalizeLiveItem`, `revealRound`, `retryRound`, `applySyncState`, `applyRemoteEstimate`, `submitEstimate` |

(`updateItem`, listed here originally, was later replaced by `setItemTitle`, which changes only the title.)

Around 20 files import `useSessionStore` (7 pages, `App`/`Header`,
`NetworkProvider`, `features/session-lifecycle` hooks, plus tests). A single-user
session never touches concern 2 at all; a manual-entry finalize
(`finalizeItem`) never touches concern 3's round state. These are
independent axes bolted together, not one cohesive domain object.

**Shape before this decomposition** (post-ADR-006 — navigation already
replaced by a router, this decomposition not yet applied):

Legend: solid = synchronous call/read.

```mermaid
flowchart TB
  subgraph APP["APP"]
    direction LR
    AppShell["App<br/>[Router Root: React Component]"]
    Header["Header<br/>[Global Nav Bar: React Component]"]
  end

  subgraph PAGES["PAGES"]
    direction LR
    Workspace["Workspace<br/>[Facilitator Screen: React Component]"]
    Participant["ParticipantEstimateView<br/>[Participant Screen: React Component]"]
    OtherPages["5 other page components<br/>[Screens: React Components]"]
  end

  subgraph SESSION["ENTITIES/SESSION"]
    Store["useSessionStore<br/>[Domain + Connection + Round State: Zustand Store]"]
  end

  Header -->|calls leaveWorkspace| Store
  PAGES -->|reads/writes all 3 concerns| Store

  classDef app fill:#eef2ff,stroke:#6366f1,color:#1e1b4b
  classDef pages fill:#ecfdf5,stroke:#10b981,color:#064e3b
  classDef session fill:#fff7ed,stroke:#f97316,color:#7c2d12
  class AppShell,Header app
  class Workspace,Participant,OtherPages pages
  class Store session
  style APP fill:#eef2ff,stroke:#6366f1,stroke-width:2px
  style PAGES fill:#ecfdf5,stroke:#10b981,stroke-width:2px
  style SESSION fill:#fff7ed,stroke:#f97316,stroke-width:2px
```

Two problems this causes concretely:

- **`leaveWorkspace` already crosses concerns internally**: it calls
  `leaveLiveSession()` (concern 2) and then clears `items`/`sessionName`
  (concern 1) in the same method. Nothing marks that boundary today because
  both live in one object.
- **Round mechanics reach into domain data**: `finalizeItem`,
  `finalizeLiveItem`, `revealRound`, `retryRound`, and `applyRemoteEstimate`
  all mutate `items` (concern 1) as part of "running a round" (concern 3).
  Whatever owns round mechanics after the split still needs to mutate items —
  the question is whether that's a same-slice call or a cross-slice one.

## Options considered

This ADR carries a fuller options-and-diagrams treatment than ADR-001–004's
prose-plus-summary-table shape, since the fourth option below was only found
by drawing the cross-store call flow and catching an FSD violation the
prose-only pass had missed — the diagrams are load-bearing here, not
illustrative.

### Option A — One store, internal slice pattern

Keep a single `useSessionStore`, but compose it internally from
slice-creator functions (Zustand's documented "slices" pattern). The runtime
shape doesn't change — one object, one hook — only the source file
organization does.

Rejected: doesn't create a real boundary. A slice's setter can still read and
mutate another slice's fields directly, because they're plain properties of
the same object — the coupling this decomposition is meant to remove would
still compile. It also doesn't map onto FSD's per-slice `model/` convention,
where state ownership should be visible from which layer/slice a file lives
in, not from a comment inside one big file.

### Option B — Split `items` into its own `entities/item` slice

Separate "what is being estimated" (item content) from "the session it's
estimated in" (concern 1 minus `items`).

Rejected for now: nothing else in the app needs an item independent of a
session — there's no second consumer to justify the boundary yet, and
ADR-004 already committed to adding a layer only when something concretely
needs it, not preemptively. Revisit if Roadmap Building (mentioned in
ADR-004's context) turns out to need standalone items.

### Option C — Round mechanics owned by a `features` slice

The initial idea discussed for this decomposition: move concern 3
(`liveRound`, `finalizeItem`, `finalizeLiveItem`, `revealRound`, `retryRound`,
`applySyncState`, `applyRemoteEstimate`, `submitEstimate`) into
`features/estimate-round` and `features/reveal-results`, since both feature
slices already exist and both consume round state.

Rejected on closer inspection: **both `features/estimate-round` and
`features/reveal-results` need this same state**, and FSD forbids same-layer
sibling slices from importing each other. A store living inside one feature
slice can't be a dependency of the other feature slice without violating that
isolation rule — the exact problem ADR-004 hit with `network/actions.ts` and
`RangeBar.tsx`, resolved there by pushing the shared thing down to
`entities/session/api` and what is now `entities/session/ui/estimate` (originally `entities/estimate/ui`; see ADR-004's 2026-10-06 update) respectively. The same fix
applies here: round mechanics stays at the `entities` layer, not `features`.

### Option D — Three stores, split along the three concerns (Decision)

- `useSessionStore` → `entities/session/model/session.ts` — concern 1.
- `useConnectionStore` → `entities/session/model/connection.ts` — concern 2.
- `useRoundStore` → `entities/session/model/round.ts` — concern 3, corrected
  from the features placement in Option C.

All three stores live in the same slice, just different files, so
`useRoundStore`'s methods can call `useSessionStore`'s item setters directly —
that's a same-slice file import, not a cross-slice one, so it doesn't need a
new public-API surface beyond what `entities/session/index.ts` already
exports. `features/estimate-round` and `features/reveal-results` then both
depend downward on `useRoundStore` and `useSessionStore`, same as any other
entity dependency.

**Decomposed shape:**

Legend: solid = synchronous call/read, dotted = async event (network message
arriving via `NetworkProvider`).

```mermaid
flowchart TB
  subgraph FEATURES["FEATURES"]
    direction LR
    EstimateRound["estimate-round<br/>[Submit Flow: Feature Slice]"]
    RevealResults["reveal-results<br/>[Facilitator Reveal/Retry: Feature Slice]"]
    LeaveWorkspace["useLeaveWorkspace<br/>[Cross-Concern Composer: Hook in session-lifecycle]"]
  end

  subgraph SESSION["ENTITIES/SESSION"]
    direction LR
    SessionStore["useSessionStore<br/>[Session Domain State: Zustand Store]"]
    ConnStore["useConnectionStore<br/>[Live Connection State: Zustand Store]"]
    RoundStore["useRoundStore<br/>[Round Mechanics State: Zustand Store]"]
  end

  subgraph NET["ENTITIES/SESSION/API"]
    NetworkProvider["NetworkProvider<br/>[Wire Protocol Bridge: React Component]"]
  end

  LeaveWorkspace -->|clears connection| ConnStore
  LeaveWorkspace -->|clears items/sessionName| SessionStore

  EstimateRound -->|submitEstimate, reads liveRound| RoundStore
  RevealResults -->|finalizeItem via useRevealRound.finalize, revealRound, retryRound| RoundStore
  RoundStore -->|writes finalResult/submissions| SessionStore

  NetworkProvider -.->|applySyncState, applyRemoteEstimate| RoundStore
  NetworkProvider -.->|setConnectionStatus, setPeerCount| ConnStore

  classDef features fill:#fdf4ff,stroke:#a855f7,color:#581c87
  classDef session fill:#fff7ed,stroke:#f97316,color:#7c2d12
  classDef net fill:#f0fdf4,stroke:#22c55e,color:#14532d
  class EstimateRound,RevealResults,LeaveWorkspace features
  class SessionStore,ConnStore,RoundStore session
  class NetworkProvider net
  style FEATURES fill:#fdf4ff,stroke:#a855f7,stroke-width:2px
  style SESSION fill:#fff7ed,stroke:#f97316,stroke-width:2px
  style NET fill:#f0fdf4,stroke:#22c55e,stroke-width:2px
```

**Responsibilities:**

| Node | Responsibility |
|---|---|
| `useSessionStore` | Session identity (`sessionName`, `unit`) and the item list's CRUD, notes/description edits |
| `useConnectionStore` | Who is connected, as what role, to what session code; peer roster and names |
| `useRoundStore` | The live round in flight — participant submissions, reveal/retry/finalize outcomes; writes results back into `useSessionStore`'s items |
| `useLeaveWorkspace` | Composes `useConnectionStore.leaveLiveSession()` and `useSessionStore`'s clear-items/name, since after the split neither store alone owns both halves of "leave" |

**Cross-store call flow — finalizing a live item:**

Legend: solid = synchronous call, numbered by call order.

```mermaid
flowchart LR
  Facilitator["Facilitator clicks Finalize<br/>[User Action]"] -->|1| RevealResults["reveal-results feature<br/>[useRevealRound Hook]"]
  RevealResults -->|"2 finalResultFor(submissions), then finalizeItem(id, result)"| RoundStore["useRoundStore<br/>[entities/session/model]"]
  RevealResults -->|"3 reads item submissions at call time"| SessionStore["useSessionStore<br/>[entities/session/model]"]
  RoundStore -->|4 writes finalResult| SessionStore

  classDef action fill:#f1f5f9,stroke:#64748b,color:#0f172a
  classDef features fill:#fdf4ff,stroke:#a855f7,color:#581c87
  classDef session fill:#fff7ed,stroke:#f97316,color:#7c2d12
  class Facilitator action
  class RevealResults features
  class RoundStore,SessionStore session
```

Step 4 is a same-slice file import (`round.ts` importing
`session.ts`, both inside `entities/session/model/`), not a cross-slice call —
this is what Option C got wrong by placing round mechanics one layer up.

## Decision

**Adopt Option D**: three stores, one per concern, with round mechanics
staying at the `entities/session` layer (not split into the `features` layer
as originally proposed) so that `estimate-round` and `reveal-results` can
both depend on it without violating same-layer sibling isolation.

The two narrower calls already settled in discussion:

- Separate stores per concern, not one store with internal slices (rejects
  Option A) — a real module boundary should exist, not just a source-file
  convention.
- `items` stays inside `entities/session`, not split into its own entity
  (rejects Option B) — no second consumer exists yet to justify it.

Navigation (the original concern that made this a four-way split) is out of
scope entirely — see ADR-006, which must land first.

## Consequences

**Positive**
- Each store's shape matches exactly what ADR-004 already established as the
  slice boundaries — no new layer, no speculative structure.
- A single-user session (never touching `useConnectionStore`/`useRoundStore`
  meaningfully) and a manual finalize (never touching `liveRound`) become
  visible as such from which stores a component imports, instead of being
  buried inside one 486-line file.
- `useLeaveWorkspace` becomes the one place that has to know "leaving" spans
  two stores — everywhere else, each store is self-contained.

**Negative / accepted trade-offs**
- Every consumer file needs its `useSessionStore(...)` calls re-pointed at the
  correct one of the three hooks — a mechanical but wide change, and the main
  reason this was deferred out of the ADR-004 migration PR.
- `entities/session/model/round.ts` importing `entities/session/model/session.ts`
  is an internal same-slice dependency with no enforcement from Steiger
  (which only checks slice/layer boundaries, not intra-slice file structure)
  — keeping it clean is on code review / the `architecture-review` subagent,
  same as any other in-slice cohesion call.

**Follow-ups / revisit triggers**
- Implemented in issue #111: `entities/session/model/session.ts`,
  `connection.ts`, and `round.ts` replace the monolithic `store.ts`, with
  cross-store writes (`round.ts` → `session.ts`'s `patchItem`; since
  refined, `connection.ts` no longer touches `session.ts` — the item-selection
  and unit-reset steps moved into the composer hooks) as
  diagrammed above, and the `leaveWorkspace`/`leaveLiveSession` compositions
  moved to `features/session-lifecycle`'s composer hooks.
- Revisit Option B (split `items` into its own entity) if Roadmap Building
  needs items independent of an estimation session.

## Alternatives considered (summary)

| Option | Rejected because |
|---|---|
| A: one store, internal slice pattern | No real module boundary — slices can still read/mutate each other's fields directly |
| B: `items` as its own entity | No second consumer today to justify the split; premature per ADR-004's own "add a layer when needed" principle |
| C: round mechanics owned by a `features` slice | Both `estimate-round` and `reveal-results` need it; FSD forbids same-layer sibling slices depending on each other |
