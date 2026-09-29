# ADR-004: Feature-Sliced Design as the Enforced Architecture

**Status:** Accepted
**Date:** 2026-09-29
**Related:** `.oxlintrc.json`, `steiger.config.ts`, `docs/concepts/` (diagram conventions), issues #111, #112

## Context

The app has grown to ~55 source files organized by technical role
(`calc/components/copy/hooks/network/persistence/screens/state`). Two things push
past that shape:

1. **More features are coming** — Story Point Estimation and Roadmap Building are
   planned next. A technical-layer split has no mechanism for keeping one feature's
   logic out of another's: Story Point code could land in `calc/`, `screens/`, and
   `state/` with nothing stopping it from reaching into estimation-session internals.
2. **This project is a pilot for future, larger, agentically-built projects.** The
   goal isn't just a good structure for this app's current size — it's learning which
   architecture guardrails generalize and can be mechanically enforced for an LLM
   agent writing code, not just documented as convention.

We considered three options:

- **Formalize the existing technical layers** (calc/components/screens/state) as
  enforced boundaries. Cheapest for this app's current size, but has no concept of
  a "feature" — doesn't solve problem (1), and doesn't transfer to future projects
  since the boundary rules would be bespoke per project.
- **Domain-driven / screaming architecture** — rename top-level folders to business
  domains. With one real domain today (estimation sessions), this mostly means
  picking a domain name and defining a shared-kernel boundary ahead of actually
  having multiple domains to separate.
- **Feature-Sliced Design (FSD)** — a full layer spec (`app/pages/widgets/features/
  entities/shared`) with strict downward-only imports, no cross-imports between
  slices on the same layer, and `ui/model/api/lib` segments inside slices. Backed by
  real tooling: **Steiger**, the official FSD architectural linter, checks layer
  direction, slice isolation, and public-API boundaries mechanically.

## Decision

**Adopt FSD**, with only the layers this app currently justifies:

```
app / pages / features / entities / shared
```

`widgets` and `processes` are deliberately skipped for now — nothing is reused
across multiple pages today (e.g. `SessionSidebar` is Workspace-only). A layer is
added the day something concretely needs it, not preemptively.

Enforcement is split by tool, per the existing convention (scanners are the source
of truth; skills/docs point at configs rather than restating rules):

- **Steiger** (`steiger.config.ts`) owns FSD structural rules exclusively — layer
  import direction, same-layer cross-slice isolation, public-API (`index.ts`)
  boundaries. It is a standalone CLI, not an ESLint/oxlint plugin, so it runs
  alongside oxlint rather than through it.
- **oxlint** (`.oxlintrc.json`) keeps owning general lint and import restrictions
  (`no-restricted-imports`, `import/no-cycle`). It does not duplicate Steiger's
  boundary rules.
- The `architecture-review` subagent covers judgment calls neither tool can make:
  slice/segment placement correctness, public-API quality, slice cohesion as new
  features land, component/hook design smells, and cross-cutting composition
  placement.

### Migration is staged into three pieces

1. **This migration** — directory structure and import boundaries only. Files move
   into their FSD homes; `Workspace.tsx`'s embedded facilitator reveal/retry logic is
   extracted into `features/reveal-results/` (the one non-mechanical move in this
   pass).
2. **Store decomposition (issue #111)** — `state/store.ts` (486 lines) currently
   mixes app navigation, session/item domain data, live-connection state, and round
   mechanics in one Zustand store, with cross-cutting methods (`leaveWorkspace`) that
   span more than one of those concerns. It moves as a single file into
   `entities/session/model/` unchanged in this migration; splitting it correctly is
   real design work bundled into a separate PR so a risky state-store decomposition
   isn't reviewed alongside a large file-move migration.
3. **Metrics ratchet (issue #112)** — oxlint's complexity/size metric rules
   (`complexity`, `max-lines`, `max-lines-per-function`, `max-depth`, `max-params`,
   `max-statements`) are not enabled in this migration. Several existing files
   (`Workspace.tsx` at 989 lines, `NetworkProvider.test.tsx`, `store.test.ts`) would
   fail immediately without oxlint's native suppression-baseline ratchet
   (`oxlint-suppressions.json` + `--suppress-all`), which needs its own CI wiring.

## Confirmed slice mapping

See the FSD guardrails plan for the full mapping. Two placements were resolved by
reading the code rather than guessing from filenames:

- `network/actions.ts` (the wire-protocol module: `SessionSnapshot`, `RosterEntry`,
  `createTypedActions()`) is **not** feature-splittable — both `estimate-round` and
  `reveal-results` depend on the same actions. It became `entities/session/api`, a
  shared wire layer both features depend on downward, not a feature slice itself.
- `hooks/useLeaveWorkspace.ts` is workspace-page-specific (composes
  `entities/session` state + disconnect, used only by the Workspace page's leave
  button) — placed in `pages/workspace/model/`, not `shared/lib`.

## Rationale

- Steiger gives mechanical enforcement of exactly the rule class an LLM agent won't
  reliably infer on its own (which slice a new file's imports are allowed to reach)
  — the primary reason this pilot's lessons should transfer to future projects.
- Splitting the migration from the store decomposition and the metrics ratchet keeps
  each review focused: a directory reshuffle, a state-ownership redesign, and a
  CI-ratchet mechanism are three different kinds of risk.
- Starting with four layers instead of all six avoids standing up `widgets/` and
  `processes/` with nothing in them — a layer with no members is a folder Claude has
  to reason about for no present benefit.

## Consequences

**Positive**
- New features (Story Points, Roadmap) get a slice boundary from day one instead of
  organically spreading across technical layers.
- Steiger's checks are mechanical and run in CI — architecture drift fails the build
  the same way a type error does, not just a review comment.

**Negative / accepted trade-offs**
- `state/store.ts` remains one monolithic file until issue #111 lands — FSD's
  per-slice state ownership isn't actually true yet for the biggest piece of state
  in the app.
- Complexity/size metrics stay unenforced until issue #112 lands — large files
  (`Workspace.tsx`) aren't flagged by a scanner yet, only by the new
  `architecture-review` subagent's judgment.

**Follow-ups / revisit triggers**
- Issue #111 — decompose `state/store.ts` into entity/feature-owned state.
- Issue #112 — oxlint suppression-baseline ratchet, then enable metric rules.
- Revisit whether `widgets/` or `processes/` are needed the first time a component
  is reused across more than one page, or a multi-step cross-feature flow emerges.

## Alternatives considered (summary)

| Option | Rejected because |
|---|---|
| Formalize existing technical layers (calc/components/screens/state) | No mechanism for feature isolation; bespoke rules don't transfer to future projects |
| Domain-driven / screaming architecture | One real domain today — would mean naming a domain and a shared-kernel boundary ahead of actually needing to separate multiple domains |
| Full FSD with all 6 canonical layers (incl. `widgets`/`processes`) | `widgets` would launch with 1–2 slices and `processes` with none — adds folders with nothing to justify them yet |
