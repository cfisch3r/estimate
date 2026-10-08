---
name: fsd-architecture
description: Feature-Sliced Design conventions for this repo — which layer/slice new or moved code belongs in, the import-direction rule, and the public-API rule. Use before creating a new file under src/, moving code between slices, or adding a new feature/entity (e.g. Story Point Estimation, Roadmap Building).
---

# Feature-Sliced Design in this repo

The rules themselves are enforced by scanners, not this skill — see
`steiger.config.ts` (layer/slice/public-API boundaries) and `.oxlintrc.json`
(general lint, import restrictions). This skill is the *why* and *where*:
what to do before the scanner would even have a chance to complain.

Full decision record: `docs/adr/004-feature-sliced-design-architecture.md`.
FSD spec: https://feature-sliced.design.

## The layers in use

```
app → pages → widgets → features → entities → shared
```

Imports only ever point **downward** (a page can import a feature, a feature
can import an entity — never the reverse). Two slices on the **same** layer
cannot import each other's internals (only through the other's `index.ts`,
and only when that's the actual intent — usually it means the code belongs
one layer down instead).

| Layer | What lives here today | Examples |
|---|---|---|
| `app` | Bootstrap only: entry point, global providers, app-shell chrome that knows about screens/routing | `app/main.tsx`, `app/App.tsx`, `app/Header.tsx` |
| `pages` | One slice per top-level screen/view | `pages/workspace`, `pages/join-session` |
| `widgets` | Composite UI reused across *more than one* page | `widgets/session-sidebar` (used by `workspace` and `session-summary`) |
| `features` | A user-facing use case/action | `features/estimate-round`, `features/reveal-results`, `features/submit-estimate`, `features/session-lifecycle` (thin start / leave wrappers that add navigation to the application use cases, plus the join flow) |
| `entities` | A business noun and its data/logic | `entities/session` (session UI only: `ItemDetailShell`, `EstimateTriple`, `RangeBar`, `DescriptionField`; stores and use cases live in `src/application`) |
| `shared` | Business-agnostic UI primitives, generic hooks, copy | `shared/ui/Button`, `shared/lib/useConfirmArm` |

`processes` is not in use — nothing today needs a cross-feature orchestrated
flow spanning multiple pages. Don't add it speculatively.

## Segments inside a slice

Within a slice, split by technical role: `ui/` (components), `model/` (state,
types, and the stateful hooks that expose a use case — `useX` hooks live here,
not in `lib/`), `api/` (external calls — network, storage), `lib/`
(framework-free helpers specific to that slice). Not every slice needs every
segment — add one when there's something to put in it. Pure decision rules that
more than one hook needs belong in `src/domain/` (e.g. `domain/roster.ts`, ADR-009
stage 1), unit-tested directly; `src/domain/` (including `domain/estimate/`, which keeps its own
`index.ts`) is outside FSD. The domain imports nothing outside itself (enforced by oxlint). `src/application/` (ADR-009 stage 3a: `stores`, `ports`, `lib`, `useCases`, `NetworkProvider`) is outside FSD too and imports only the domain and itself (enforced by oxlint). UI code imports domain symbols from `src/domain` directly and stores and use-case hooks from the `src/application` barrel; navigation stays in `features/`.

Component CSS lives beside its component and is imported by it (shared
components' sheets sit in `shared/ui/*.css`; `pages/workspace/ui/workspace.css`
holds `.workspace-*` rules only); `src/design/`
holds only the design-system layer (`nocturne.css` and generic composed patterns).

## The public-API rule

Only a slice's `index.ts` is importable from outside that slice. Never reach
into a slice's internals directly from a page — import from its barrel (stores and use-case hooks come from the `src/application` barrel). Steiger enforces this
(`fsd/no-public-api-sidestep`, `fsd/public-api`); a missing barrel is an error,
not a style choice. A barrel may export a narrowed view instead of the raw
object: `src/application` exports `useConnectionStore` / `useRoundStore` as types
without the network-bridge mutators (`stores/publicStores.ts`), and
`NetworkProvider` writes through the internal stores.

## Cross-entity imports: `@x`

There is currently only one entity (`entities/session`), so no cross-entity
imports exist and no `@x` surfaces are in use. `entities/estimate` used to be a
separate slice reached through `@x`; it was merged into `entities/session`
because estimates are value objects owned by the session's rounds, not an
independent entity (see ADR-004's 2026-10-06 update). If a genuinely independent
second entity ever needs another, expose a narrow
`entities/<provider>/@x/<consumer>.ts` surface rather than adding a Steiger
exemption.

## Where does new code belong?

Work through these in order — the first one that fits wins:

1. **Is it a business noun with its own data shape, independent of any
   specific user action?** (e.g. a roadmap item; a value object owned by an
   existing entity, like an estimate, stays inside that entity) →
   `entities/<noun>`. Put its type, validation, and any generic display
   component (like `entities/session/ui/estimate/RangeBar.tsx`) here.
2. **Is it one user-facing action/workflow built on top of one or more
   entities?** (e.g. "estimate a round", "reveal results", "assign story
   points") → `features/<verb-noun>`. If two features would need the exact
   same UI or logic, that shared piece almost always belongs at the entity
   level instead (see the `RangeBar` and `adapters/network/actions.ts`
   cases in the ADR) — cross-feature imports are forbidden, so this isn't
   optional.
3. **Is it a full top-level screen composition?** → `pages/<screen>`. A page
   wires entities/features/widgets together; it shouldn't contain reusable
   business logic of its own.
4. **Is it reused by more than one page, but isn't a full screen?** →
   `widgets/<name>`. Don't create a widget for something used by exactly one
   page — that's page-local UI, not a widget. Promote it the day a second
   page needs it (this happened for real during the FSD migration —
   `SessionSidebar` moved from a page-local file to `widgets/session-sidebar`
   once `session-summary` needed it too).
5. **Is it generic — no domain knowledge, would make sense in any app?** →
   `shared/ui` or `shared/lib`.

### Before adding a new entity or feature (e.g. Story Points, Roadmap)

- Check whether the new concept is really a new entity, or an existing one
  (`session`) with an extra field. Prefer
  extending an existing entity over creating a near-duplicate.
- If it's genuinely new, give it its own `entities/<name>` (or
  `features/<name>` if it's an action, not a noun) rather than bolting it
  onto an unrelated existing slice — Steiger's `fsd/insignificant-slice`
  warning is a hint to check this, not something to silence by default. One
  place in this repo intentionally suppresses that warning
  (`features/submit-estimate`) with a documented
  reason in `steiger.config.ts` — follow that pattern (a comment explaining
  *why* the slice is real despite one consumer) rather than merging code
  back into a bigger slice just to satisfy the linter.

## Judgment calls this skill doesn't cover

Whether a split actually improved cohesion, whether a slice's public API
leaks internals it shouldn't, or whether a chunk of code chose the
*technically valid* slice but the *wrong* one — that's the
`architecture-review` subagent's job, not a rule you can check mechanically
before writing code. See `.claude/agents/architecture-review.md`.
