# ADR-006: Adopt `react-router`, Replacing Faked `currentScreen` Navigation

**Status:** Accepted
**Date:** 2026-09-30
**Related:** [005-session-store-decomposition.md](005-session-store-decomposition.md), issue #116

## Context

`entities/session/model/store.ts` faked routing with a hand-rolled
`currentScreen: ScreenId` field and a `goToScreen` action. `src/app/App.tsx`
read `currentScreen` and rendered the matching component from a
`SCREENS: Record<ScreenId, ComponentType>` map — one URL for the whole app,
no distinct paths per screen, no back/forward button support, nothing
bookmarkable or shareable.

This surfaced as a blocker while planning issue #111 (splitting that store
into per-concern stores — see ADR-005). ADR-005 proposed isolating navigation
into its own `useNavigationStore` under `app/model/`, but that breaks FSD's
layer-direction rule (enforced by Steiger): pages call `goToScreen` directly,
and pages cannot import from `app` (`app` sits above `pages` in the FSD layer
order — a layer may only import from layers below it).

Trying to find navigation an FSD-compliant home was solving the wrong
problem: navigation isn't session domain data, isn't owned by any entity,
and a hand-rolled "current screen" flag is exactly what a router already
does correctly — including things it wasn't attempting (history stack, back/
forward, deep links, scroll restoration).

## Options considered

- **A — `useNavigationStore` in `app/model/`** (ADR-005's original proposal).
  Rejected: violates FSD layer direction — pages importing from `app` is
  backwards.
- **B — `useNavigationStore` in `shared/`** (layer-legal by pushing it down).
  Rejected: still reinvents routing as bespoke app state instead of using a
  library that already solves it.
- **C — Adopt a real router (Decision).**

## Decision

**Adopt `react-router`** (the current major version, which unifies what used
to be the separate `react-router-dom` package — only `react-router` is
installed; `BrowserRouter`, `Routes`, `Route`, `useNavigate`, `useLocation`
all come from it).

**Path scheme** — one real path per existing screen, 1:1, no new URL state:

| Screen | Path |
|---|---|
| Mode select | `/` |
| Join session | `/join` |
| Participant estimate | `/estimate` |
| Workspace | `/workspace` |
| Session summary | `/summary` |
| Session history | `/history` |

Deep-linkable state (e.g. a session code in the URL) is explicitly out of
scope here — tracked as its own follow-up issue, gated on a product decision
about whether facilitators want shareable join links at all.

**Navigation-ownership resolution** — the real wrinkle this decision had to
solve: several store actions navigated as an internal side effect
(`startSingleUser`, `startCollaborative`, `joinLiveSession`,
`leaveLiveSession`). A router's `useNavigate` is a hook, callable only from
component/hook render context — never from a plain function inside a
Zustand `create()` callback. So:

- Those four store actions became pure — they no longer touch navigation at
  all.
- `startSingleUser`/`startCollaborative` gained two new composer hooks in
  `features/session-lifecycle/model/` (`useStartSingleUser`, `useStartCollaborative`),
  each pairing the store action with `navigate('/workspace')`. This mirrors
  the pattern already established by `useLeaveWorkspace`/`useLeaveLiveSession`
  — a hook that composes a store action with something store-external — so
  call sites keep the same shape (`onClick={startSingleUser}`), just from a
  different import.
- `leaveLiveSession`/`leaveWorkspace` were already wrapped by
  `useLeaveLiveSession`/`useLeaveWorkspace`; those two existing hooks were
  extended to also call `navigate('/')`, rather than adding new ones.
- `joinLiveSession`'s old `currentScreen: 'join'` write was a no-op (its only
  caller, `JoinSession`, is already rendering that screen when it's called)
  — dropped with no replacement.
- Already-explicit call sites (`goToScreen('summary')` in `Workspace`/
  `SessionSummary`, the `useEffect`-driven `goToScreen('estimate')` in
  `JoinSession`, etc.) stay exactly where they are, just calling
  `navigate('/path')` from `useNavigate()` instead of `goToScreen('path')`
  from the store.

**Removal** — `ScreenId`, `currentScreen`, `goToScreen` are deleted entirely
from `entities/session`, not deprecated or kept as a compatibility shim.

**`SessionSidebar`'s `currentScreen: ScreenId` prop** became a router-agnostic
`isSummaryScreen: boolean` (it was only ever compared against `'summary'` for
highlighting), computed by each caller page from its own
`useLocation().pathname === '/summary'` — keeping the widget itself
purely prop-driven, with no router dependency of its own.

*Amended 2026-10-02:* the sidebar later took over reading the session store and
the router itself, because both consuming pages were repeating the same store and
router wiring.

*Amended 2026-10-05:* the sidebar's own Summary button was dead UI (Workspace's
top bar carries the Summary link) and was removed, which also removed the widget's
router dependency. It takes only the layout props `highlightActive` (off on the
summary page, where no item is current) and `scrollableList`. The hooks named above
live in `features/session-lifecycle` (see ADR-004's 2026-10-05 update).

**ADR-005 amendment**: navigation is removed from that decomposition
entirely. What was a four-store split there is now three — see ADR-005's
updated Context/Decision sections.

## Consequences

**Positive**
- Real browser back/forward and per-screen URLs, for free — a foundation the
  join-link follow-up can build on.
- Removes an entire concern from ADR-005's decomposition without needing to
  invent a new FSD layer for it.
- No FSD layer-direction question to resolve going forward: router hooks are
  library-owned, not a slice anyone has to place.

**Negative / accepted trade-offs**
- Touched all 9 consumer files (and their tests) that referenced
  `currentScreen`/`goToScreen`/`ScreenId` in one pass.
- Two new composer hooks added to `features/session-lifecycle/model/`, growing that
  segment's surface area.
- Component tests that render anything touching navigation now need a
  `MemoryRouter` wrapper (or a mocked `useNavigate`) — a new fixed cost per
  affected test file.

**Follow-ups / revisit triggers**
- Issue #111 (ADR-005's store decomposition) can now proceed against a
  three-concern store.
- A deferred follow-up issue tracks shareable `/join/:code` links, blocked on
  a product decision about session-code confidentiality — not scoped here.

## Alternatives considered (summary)

| Option | Rejected because |
|---|---|
| A: `useNavigationStore` in `app/model/` | Violates FSD layer direction — pages importing from `app` is backwards |
| B: `useNavigationStore` in `shared/` | Layer-legal, but reinvents routing (history, back/forward, deep links) that a library already does correctly |
