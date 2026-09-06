# AGENTS.md

Instructions for any AI coding agent working in this repository.

## Project context

EstiMate is a live three-point estimation tool for dev teams. Before making non-trivial changes, read:

- `docs/prd.md` — product requirements
- `docs/architecture.md` — the technical architecture (stack, module structure, `/calc` design) and decisions made building it
- `docs/adr/001-live-collaboration-architecture.md` — accepted decision on the peer-to-peer live-collaboration architecture
- `docs/adr/002-testing-strategy.md` — accepted decision on the layered test strategy (unit/component now; Playwright deferred until `/network` or `/persistence` get real implementations — see that ADR before adding e2e tests or building those modules)
- `docs/concepts/collaboration-mode.md` — Live mode (Mode A) technical concept: the Trystero P2P network layer, join flow, and screen/store wiring delivered so far
- `design_handoff_estimate_app/` — the design reference (Nocturne design system, clickable HTML prototype). Not production code to copy directly.

## Picking the next task

Work is tracked on the **EstiMate Roadmap** GitHub Project (https://github.com/users/cfisch3r/projects/1) as a **two-level ordered backlog**:

- **Epics** — issues titled `Epic: …`, sitting in the `Backlog` column, drag-ordered. Their order (top = highest priority) is read from `gh project item-list 1 --owner cfisch3r` order.
- **Stories** — each epic's **sub-issues**, drag-ordered within that epic's sub-issue list. That list is the *only* source of truth for story order; a story's own card position on the board is cosmetic.

**Next task = the first open sub-issue of the first open epic in `Backlog`.** An epic whose sub-issues are all closed is finished — move to the next epic. Always read the story's body before starting.

```sh
# first open epic in Backlog
gh project item-list 1 --owner cfisch3r --format json | \
  jq -r 'first(.items[] | select(.status=="Backlog" and (.content.title | startswith("Epic:"))) | .content.number)'
# that epic's stories, in priority order (replace 30)
gh api graphql -f query='{repository(owner:"cfisch3r",name:"estimate"){issue(number:30){subIssues(first:50){nodes{number state title}}}}}'
```

Keep the `Backlog` column on **Manual sort** — re-applying a field sort silently disables drag-ordering. Use *group by Parent issue* for epic swimlanes. Milestones are retired: the closed `M0`–`M3` remain only as historical record.

## Commands

```
pnpm dev             # start the dev server
pnpm build            # type-check (tsc -b) and production build
pnpm lint             # oxlint
pnpm format           # prettier --write
pnpm format:check     # prettier --check
pnpm test             # vitest run, summary output
pnpm test:verbose     # vitest run, every individual test name and result
pnpm test:coverage    # vitest run --coverage
```

Run `pnpm build`, `pnpm lint`, `pnpm format:check`, and `pnpm test` before considering any change complete.

## Code conventions

- **TypeScript strict mode** (`strict: true`, `noUncheckedIndexedAccess: true`) — don't loosen these.
- **Domain types with invariants are self-validating value types, not bare interfaces.** If a type has a constraint between its fields (e.g. an ordering, a required relationship), it should only be constructible through a factory that enforces the constraint, so illegal states can't be represented — see `src/calc/estimate.ts`'s `createEstimate()` for the pattern (a `Result`-returning factory plus a compile-time-only phantom brand, so the type stays plain, JSON-transparent data). Don't reintroduce a bare structurally-typed interface for a concept that has a real invariant.
- **`/calc` is pure and framework-free** — no React, no I/O, no network/storage imports. Functions there should be thoroughly unit-tested (the module currently sits at 100% statement/branch coverage on its real surface — test helpers' defensive-throw branches are the one deliberate exception).
- **Nocturne's `src/design/nocturne.css` is a verbatim, unmodified port** of the design system's canonical stylesheet — don't edit it to add app-specific styling. New composed patterns built from Nocturne primitives (e.g. `radio-tile.css`) live in their own file instead, so `nocturne.css` stays a clean diff against its source if the design system is ever re-pulled.
- Guard/validation functions return structured results (`{fired, deviationPct}`, `{ok, value/error}`) rather than throwing or returning bare booleans, so callers can access the reasoning, not just the verdict.

## Commit conventions

- Do not add a `Co-Authored-By: Claude` (or similar AI co-author) trailer to commit messages in this repo.
- Prefer new commits over amending; one milestone/logical change per commit.

## Collaboration workflow (GitHub)

Repo is solo-maintained (Christian + Claude Code, no other human collaborators). As of 2026-08-22:

- **Trivial changes** (typo, doc tweak): direct push to `main`, no branch/PR needed.
- **Issue-sized work**: one branch per issue (`issue-<n>-<slug>`), PR opened with `Closes #n` in the description, squash-merge into `main`.
- **Review**: after opening the PR, run the `code-review` skill as an independent pass over the diff (medium effort by default, higher for anything touching `/network` or `/persistence`). Apply confirmed fixes as follow-up commits on the same branch.
- **Merge gate**: always ask the user whether they want to personally review the PR before merging — even after the automated review comes back clean. Never auto-merge without asking.
- **Tracking**: the `EstiMate Roadmap` GitHub Project board (https://github.com/users/cfisch3r/projects/1), Backlog → In Progress → In Review → Done. Work is a two-level ordered backlog of epics and their sub-issues — see [Picking the next task](#picking-the-next-task). Milestones are retired (closed `M0`–`M3` kept as history).

## Concept docs & diagrams

Technical concept / architecture write-ups live in `docs/concepts/`. Keep them short and
diagram-driven — several complementary views (component, sequence, state machine, screen
flow), not long prose. Prefer tables and diagrams over paragraphs.

Diagram conventions (all Mermaid):

- **Component views**: use C4-style box labels — `Name` on line 1, `[type]` on line 2 (e.g.
  `[React Component]`, `[Zustand Store]`, `[Factory Function]`) — but draw them as a
  `flowchart`, **not** Mermaid's native `C4Component` type (its auto-layout and arrow routing
  are too messy here).
- Put each component's **responsibilities in a table below the diagram**, never inside the
  boxes.
- Group nodes into subgraph **"lanes"** (usually by source directory). Each lane gets an
  emoji + UPPERCASE title, a light background tint, and member nodes coloured to match via
  `classDef` / `class`; use `direction LR` inside multi-node lanes. External systems stay
  outside all lanes with a dashed border.
- **Legend above every diagram**: solid line = synchronous call, dotted = async
  callback/event/read, `<-->` = bidirectional. Label edges with what crosses them.
- Collapse many parallel edges (e.g. store → each screen) into one edge pointing at the lane.

`docs/concepts/collaboration-mode.md` is the reference example.
