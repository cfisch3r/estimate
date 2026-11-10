# AGENTS.md

Instructions for any AI coding agent working in this repository.

## Project context

EstiMate is a live three-point estimation tool for dev teams. `docs/domain/` and
`docs/technical/` are two different models of the same system, not two depths of the same
thing: domain describes what EstiMate does (process, information model, rules),
independent of how it's built; technical describes how the domain model is realized in
code, and depends on it — never the reverse. Before making non-trivial changes, read:

**Domain**

- `docs/domain/prd.md` — product requirements: problem, goals, non-goals, primary user &
  core flow, non-functional requirements, open questions, future phases
- `docs/domain/concepts/live-collaboration.md` — domain concept: the Live and Manual mode
  processes, the Session/Item/Estimate/Participant/Roster information model, and the rules
  (privacy before reveal, no mid-session mode switch, late-join catch-up)
- `docs/domain/concepts/estimation-method.md` — domain concept: the three-point estimation
  process, the Estimate/AggregateResult/uncertainty-level information model, and the
  bias-guard rules
- `docs/domain/concepts/screen-flow.md` — domain concept: the screen-flow diagram and
  per-screen content table for Mode selection, Workspace, Join Session, Participant
  Estimate View, and Session Summary

**Technical**

- `docs/technical/architecture.md` — the technical architecture in arc42 form: context view, layer and component views, crosscutting concepts, risks. Start here for where code belongs
- `docs/technical/architecture-rules.md` — the architecture rules with what enforces each; cite them by name in reviews
- `docs/technical/review-risk.md` — the review risk catalogue: named categories of change with a minimum risk each, so a review can cite them by name (`wire-contract`, `domain-math`); the data block is read by `pnpm review:floor`
- `docs/technical/adr/001-live-collaboration-architecture.md` — accepted decision on the peer-to-peer live-collaboration architecture
- `docs/technical/adr/002-testing-strategy.md` — accepted decision on the layered test strategy: unit/component, plus a thin Playwright e2e layer since #26 landed the real browser-connection behaviour that was this ADR's own trigger — see that ADR's 2026-09-07 and 2026-09-30 updates, and ADR-007 for the e2e layer's own design
- `docs/technical/adr/007-e2e-dual-mode-signaling.md` — accepted decision on dual-mode signaling for the Playwright e2e suite: a locally self-hosted relay by default (blocking CI), production Nostr relays in a separate nightly/manual job
- `docs/technical/adr/003-session-reliability-model.md` — accepted decision on who owns live-session state and what reconnect restores: facilitator-authoritative rounds, a values-free submission roster in the snapshot, acknowledged submissions with a kind-driven retry policy, stable client identity, and role-asymmetric link state. **Read before working #9, #60, #61, #62, or #63** — it is the design anchor for all of them; the ADR's own status line tracks which elements have landed, rather than duplicating that list here.
- `docs/technical/concepts/collaboration-mode.md` — Live mode (Mode A) technical concept: the Trystero P2P network layer, join flow, participant estimate round, facilitator reveal / retry-round flow, and screen/store wiring delivered so far. Implements `docs/domain/concepts/live-collaboration.md`
- `docs/technical/concepts/estimation-engine.md` — the estimation engine's detailed design (aggregation, the `Estimate` value type, bias guards). Implements `docs/domain/concepts/estimation-method.md`
- `docs/technical/concepts/e2e-testing.md` — E2E testing technical concept: the Playwright/fixture/signaling component wiring, the dual-mode (local relay / real-world) build-and-run flows, and the spec-to-wire-action coverage map
- `docs/technical/runbook.md` — deployment & release runbook: the IONOS Deploy Now CD pipeline, secrets, troubleshooting, and versioning/release process
- `docs/technical/adr/004-feature-sliced-design-architecture.md` — accepted decision on Feature-Sliced Design (FSD) as the enforced architecture: the adopted layer set (`app/pages/widgets/features/entities/shared`), the slice mapping, and the completed follow-ups (store decomposition, see ADR-005; advisory `pnpm metrics` hotspots instead of a metrics ratchet). The `react-webapp-architecture` plugin's code-placement skill has the day-to-day "which layer, then which slice does new code belong in" guidance; `steiger.config.ts` is the enforcement source of truth for layer/slice/public-API boundaries
- `docs/technical/adr/005-session-store-decomposition.md` — accepted decision on splitting the monolithic session store into three per-concern stores (`session.ts`, `connection.ts`, `round.ts`, now in `src/application/stores`; navigation is out of scope — see ADR-006). Implemented in issue #111.
- `docs/technical/adr/006-router-adoption.md` — accepted decision on replacing the hand-rolled `currentScreen`/`goToScreen` navigation state with `react-router`, resolving an FSD layer-direction conflict ADR-005 hit
- `docs/technical/adr/008-accessibility-testing-strategy.md` — accepted decision on the three-layer automated accessibility stack (oxlint `jsx-a11y`, `jest-axe` component scans, real-browser `@axe-core/playwright` e2e scans) and the deliberate, tracked `color-contrast` exclusion (issue #123)
- `docs/technical/adr/009-architecture-style-fsd-vs-hexagonal-core.md` — accepted decision to replace FSD-everywhere with a hexagonal core plus an FSD UI, staged in three steps, all done (stages 1 and 2 were the `src/domain/` and `src/adapters/` extractions; stage 3 was the `src/application/` extraction, 3a-3d; 3d split the UI-only `entities/session` slice into `entities/item` and `entities/estimate`; 3b-1 moved the store rules into `src/domain`, 3c split the provider (then `NetworkProvider`, now `LiveSessionProvider`) into a framework-free live-session controller plus a thin shell in `src/app`). It governs where non-UI code goes; ADR-004 and ADR-005 describe the pre-extraction layout (stores and use cases are now in `src/application`). Read it before proposing structural moves of non-UI code
- `docs/technical/adr/010-spec-first-gherkin-specs.md` — accepted decision on spec-first development: a `specs/<concept>/<test level>/` tree of executable Gherkin specs (`playwright-bdd` for the `e2e` Test Level), a dependency-cruiser rule keeping each Test Level's driver code out of `src/`, and the two asked-not-assumed workflow steps in [Picking the next task](#picking-the-next-task)

**Shared**

- `docs/glossary.md` — the architecture vocabulary (layer, type, aggregate, entity, value object, inbound/outbound adapter, port, FSD slice/segment) and which words to avoid; use these terms and add new ones there
- `design_handoff_estimate_app/` — the original design reference (Nocturne design system, clickable HTML prototype). Not production code to copy directly.
- `design_handoffs/epic-0010-screen-design-review/` — the Epic-0010 redesign handoff; **supersedes the entry flow** of the original handoff (mode-selection screen + unified Workspace) and is the source of truth for the participant estimating and facilitator reveal flows.
- `design_handoffs/design_handoff_uncertainty_range/` — the Phase Picker + guidance-aware Range Bar handoff for PRD §5's cone-of-uncertainty guard; high-fidelity design reference, not literal production code (see its README for known implementation deviations).
- `design_handoffs/design_handoff_workspace_redesign/` — the merged-card/grouped-fields/adjacent-nav Workspace redesign handoff (single-user Workspace, facilitator live mode, participant estimate view); low-fidelity wireframe reference, not literal production code (see its README for the app's real Nocturne components and screen-by-screen spec).

## Picking the next task

The Developer names the next issue directly — there is no automated backlog-walking. The
**EstiMate Roadmap** GitHub Project board is being retired, and whether `epic`-labeled
issues keep being used at all is undecided; don't assume either one when reasoning about
priority. If asked to start "the next issue" or "the next task" without a number, ask the
Developer which one — never guess from issue order, labels, or the board.

When told to start an issue, **fetch it and stop**: summarise the issue body, flag
ambiguities, superseding design handoffs, and scope questions, then wait for an explicit
go-ahead. Do not move to a design artifact, a spec, a plan, a todo list, a branch, or edits
until then.

Once the go-ahead is given, two further steps are each **offered — asked explicitly every
time, never assumed, both optional** — before planning and implementation start
([ADR-010](docs/technical/adr/010-spec-first-gherkin-specs.md)):

1. **A design artifact**, published with the Artifact tool, before any branch exists. It's
   ephemeral — scoped to this one story, never committed as a file. Fold anything worth
   keeping into the permanent docs once the story ships, then let the artifact go.
2. **A failing executable spec**, after the branch is created, before planning or
   implementation. Write the scenario as a `.feature` file plus driver code at the
   appropriate **Test Level** (`docs/glossary.md`) under `specs/<concept>/<test level>/`,
   generate it, and confirm it fails for the right reason before any implementation code is
   written.

Once planning starts, the [Collaboration workflow](#collaboration-workflow-github) applies
(branch per issue, PR with `Closes #n`, review passes, ask before merge).

Milestones are retired: the closed `M0`–`M3` remain only as historical record.

## Commands

```
pnpm dev                  # start the dev server
pnpm build                # type-check (tsc -b) and production build
pnpm typecheck            # type-check only (tsc -b), no bundling
pnpm preview              # serve the production build locally
pnpm lint                 # oxlint
pnpm arch                 # steiger (FSD inside the UI) and dependency-cruiser (layer rules, `pnpm arch:layers`)
pnpm arch:specs           # dependency-cruiser on specs/ (Test Level driver code may not import src/, ADR-010); separate from `pnpm arch`, but runs in CI and the Stop hook
pnpm format               # prettier --write
pnpm format:check         # prettier --check
pnpm test                 # vitest run, summary output
pnpm test:watch           # vitest in watch mode
pnpm test:verbose         # vitest run, every individual test name and result
pnpm test:coverage        # vitest run --coverage; also enforces the `src/domain` 100% threshold below
pnpm test:e2e             # bddgen (ADR-010), then Playwright, real WebRTC via a local self-hosted relay (ADR-007)
pnpm test:e2e:real-world  # same specs against production signaling (public Nostr relays)
pnpm test:e2e:ui          # Playwright UI mode, for local debugging
pnpm deadcode             # knip — unused exports/files/dependencies
pnpm metrics              # advisory complexity/size hotspots in the diff (`pnpm metrics all` for src/); never gates
pnpm review:floor         # minimum review risk of the branch plus working tree from docs/technical/review-risk.md (`pnpm review:floor <commit>` for changes since a commit); prints JSON
pnpm review:guide         # render the Review guide page from the floor, signals and risk-review answer files (`--floor`, `--signals`, `--agent`; optional `--covers`, `--title`); prints HTML
pnpm review:signals       # evidence for the risk review of the branch plus working tree: file history, metrics, changed-line coverage (runs the unit tests), dependency diff and audit; each section may say "not available"; prints JSON
```

Run `pnpm build`, `pnpm lint`, `pnpm arch`, `pnpm arch:specs`, `pnpm format:check`,
`pnpm test`, `pnpm test:coverage`, `pnpm deadcode`, and `pnpm test:e2e` before considering
any change complete. (`pnpm test:e2e:real-world` is not part of that list — it runs nightly and on
manual dispatch only, never gates a PR.) These
also run as required checks in CI (`.github/workflows/ci.yml`) on every PR and push to
`main` — running them locally first is a courtesy that catches failures before you push,
not the only gate.

Project-owned Claude Code tooling lives in `.claude/` (versioned). The doc, risk and
accessibility reviews below are skills-directory plugins, one folder each in
`.claude/skills/<name>/` holding the skill, its `reviewer` agent and any hooks or scripts.
Claude Code loads each as `<name>@skills-dir` without an install once the folder is trusted;
the agent is named `<name>:reviewer`. In a desktop worktree session the plugins come from the
main checkout, so a change to one on the branch takes effect only after the merge (apart from
scripts run through `pnpm`).

- **`/doc-review`** — read-only documentation audit run in the `doc-review:reviewer` agent.
  Checks docs for accuracy against shipped code, cross-reference integrity, and
  conformance to this file's conventions. Defaults to the current diff; `/doc-review all`
  for a full audit, or pass a path. Reports severity-ranked findings and applies nothing.
- **`/risk-review`** — builds the Review guide of the branch on request, for a reader who
  wants to know where to look. The `risk-review:reviewer` agent starts from the deterministic floor
  (`pnpm review:floor`, see `docs/technical/review-risk.md`), may raise the risk and name hot spots but
  never lower the floor, and replies with one JSON answer (risk, categories, hot spots,
  skim-only files, what could not be verified). `pnpm review:guide` turns that into a page,
  which is published as a private artifact. Changes no code. Its plugin also holds the floor
  hook after `gh pr create` and the scripts behind `pnpm review:*`.
- **`/accessibility-review`** — read-only accessibility audit run in the
  `accessibility-review:reviewer` agent. Covers judgment calls oxlint's `jsx-a11y` plugin and
  the `jest-axe`/`@axe-core/playwright` scans can't make: ARIA pattern appropriateness,
  focus-order sanity, live-region needs, contrast judgment calls outside the e2e scan's
  scope (see ADR-008). Defaults to the current diff; `/accessibility-review all` for a
  full audit, or pass a path.
- **Hooks** (`.claude/settings.json` + `.claude/hooks/`) — a `PreToolUse` Bash block on Claude/Anthropic
  attribution trailers in commit messages and PR bodies; a `PreToolUse` hard block on
  writes outside the repo (apart from `~/.claude`, the Obsidian inbox and the Claude scratchpad), paths containing `..`, edits under `.git`, `node_modules` and `.env` files, and edits to `nocturne.css`; a `PostToolUse` per-file
  `oxlint` check (surfaces output, never blocks); a `Stop` hook running `pnpm lint`
  (including the `jsx-a11y` plugin)/typecheck/`pnpm arch`/`pnpm deadcode`/
  `pnpm test:coverage` once per turn.

Architecture review and code placement come from the **`react-webapp-architecture` plugin**
(personal marketplace `agiledojo-plugins`, installed with `--scope local`; `.worktreeinclude`
carries that setting into new worktrees). It brings its own standard (default layout, layer
table, rules) and reads nothing of this repo but the code:

- **`/react-webapp-architecture:review`** — read-only architecture audit run in the
  plugin's `reviewer` agent. Covers judgment calls Steiger/dependency-cruiser can't make: layer
  placement (domain / application / adapters / UI, store action vs use case), FSD slice
  placement, public-API quality, slice cohesion, component/hook design smells,
  cross-cutting composition placement. Defaults to the current diff; `all` for a full
  audit, or pass a path.
- **code-placement skill** — loaded automatically before creating a new file under `src/`
  or moving code between layers or slices.
- **Exceptions** to the plugin's standard live at the code as
  `// architecture-exception: <rule-name> — <reason>` comments (for example the round store's
  `patchItem` access), not in a doc.

Where the plugin isn't installed (a fresh clone, a cloud session, another agent), say so
in the PR instead of skipping the architecture review silently, and ask the Developer to
run it.

## Code conventions

- **TypeScript strict mode** (`strict: true`, `noUncheckedIndexedAccess: true`) — don't loosen these.
- **Domain types with invariants are self-validating value types, not bare interfaces.** If a type has a constraint between its fields (e.g. an ordering, a required relationship), it should only be constructible through a factory that enforces the constraint, so illegal states can't be represented — see `src/domain/estimate/estimate.ts`'s `createEstimate()` for the pattern (a `Result`-returning factory plus a compile-time-only phantom brand, so the type stays plain, JSON-transparent data). Don't reintroduce a bare structurally-typed interface for a concept that has a real invariant.
- **`src/domain` (including `domain/estimate`, formerly `/calc`) is pure and framework-free** — no React, no I/O, no network/storage imports. Functions there should be thoroughly unit-tested (100% coverage — statements, branches, functions, and lines — is enforced in CI via `pnpm test:coverage`'s `vite.config.ts` threshold; `testHelpers.ts` and `testFixtures.ts` are excluded from that threshold wholesale, since their only untested content is one deliberately-untested defensive-throw branch each; dependency-cruiser forbids the domain from importing anything outside itself and oxlint forbids I/O globals). `pnpm deadcode` (knip) also runs in CI to catch exported-but-uncalled code anywhere in `src/` before it can hide from that threshold behind a barrel re-export, and `pnpm arch` (Steiger and dependency-cruiser) catches FSD and layer boundary violations — see ADR-004.
- **Nocturne's `src/design/nocturne.css` is a verbatim, unmodified port** of the design system's canonical stylesheet — don't edit it to add app-specific styling. New composed patterns built from Nocturne primitives (e.g. `radio-tile.css`) live in their own file instead, so `nocturne.css` stays a clean diff against its source if the design system is ever re-pulled.
- Guard/validation functions return structured results (`{fired, deviationPct}`, `{ok, value/error}`) rather than throwing or returning bare booleans, so callers can access the reasoning, not just the verdict.
- **A test asserting a callback fired in response to one simulated user action should assert `toHaveBeenCalledTimes(1)` alongside `toHaveBeenCalledWith(...)`, not the latter alone.** `toHaveBeenCalledWith` passes whether the callback fired once correctly or twice (once right, once wrong) — it can't tell a clean single fire apart from a double-fire bug (e.g. a click handler that also triggers a parent's pointerdown listener via bubbling). See `PhasePicker.test.tsx`'s step-dot/nudge-arrow tests for the pattern.

## Accessibility & browser support

Automated accessibility checking (oxlint `jsx-a11y`, `jest-axe` component scans,
real-browser `@axe-core/playwright` e2e scans, and the deliberate, tracked
`color-contrast` exclusion) is documented in
[ADR-008](docs/technical/adr/008-accessibility-testing-strategy.md).

- **Supported browsers**: the last 2 versions of evergreen Chrome, Firefox, Safari,
  and Edge. No IE11 or other legacy-engine support — Vite's own defaults already
  target modern JS, so this is a statement of intent for manual QA and bug triage
  (e.g. "does this reproduce on the oldest browser we claim to support"), not a
  build-time enforcement mechanism.

## Commit conventions

- Do not add a `Co-Authored-By: Claude` (or similar AI co-author) trailer to commit messages in this repo.
- Prefer new commits over amending; one milestone/logical change per commit.

## Collaboration workflow (GitHub)

Repo is solo-maintained (Christian + Claude Code, no other human collaborators). As of 2026-09-18:

- **All changes** — from a one-line typo fix to a full issue — go through a branch + PR. `main`'s branch protection requires the `ci-passed` and PR-title-lint status checks with `enforce_admins` on, so direct pushes are rejected outright. A trivial/no-issue change can use any descriptive branch name and skip `Closes #n`.
- **Issue-sized work**: one branch per issue (`issue-<n>-<slug>`), PR opened with `Closes #n` in the description, squash-merge into `main`.
- **PR titles must follow [Conventional Commits](https://www.conventionalcommits.org/)** (`feat: ...`, `fix: ...`, `chore: ...`, `docs: ...`, etc.) — squash-merging makes the PR title the commit message on `main`, and [release-please](docs/technical/runbook.md#versioning--releases) parses that history to cut releases. Enforced as a required status check ([PR title lint](docs/technical/runbook.md#how-releases-are-cut)); `pnpm install` also wires up a local `commit-msg` hook that warns (non-blocking) on individual commits.
- **Opening a PR**: fill in `.github/pull_request_template.md` (a one-sentence why, special things to note, a change outline) and pass it to `gh pr create --body-file`; the title is a Conventional Commit. Push first, never commit to `main`, and open the PR only when none of yours is open (release-please's excepted). The risk-review plugin's hook then shows the review floor of the PR (`pnpm review:floor`: minimum risk and categories); name it in your answer, first. Where the plugin isn't loaded and no floor appears, run `pnpm review:floor` yourself. The PR body carries no review guide. When the user asks for one while reviewing, run `/risk-review`: it builds the **Review guide** as a private artifact for the pushed branch as it is now; run it again for a newer commit.
- **Review**: after opening the PR, run the `code-review` skill with the arguments `medium origin/main...HEAD` (effort level, then explicit target; see *Code review skill*) as an independent pass over the diff. Also run `/react-webapp-architecture:review` (read-only, covers layer and FSD slice placement and design judgment calls) on any PR touching `src/`. If the PR touches interactive `src/` UI or visual styling/DOM structure (ARIA roles, focus handling, dynamic content, new color-token pairings, or DOM/layout reordering), also run `/accessibility-review` (read-only, covers ARIA pattern appropriateness, focus-order sanity, live-region needs, contrast judgment calls — see ADR-008). Apply confirmed fixes as follow-up commits on the same branch. If the PR touches `docs/`, `README.md`, `AGENTS.md`, or changes module structure / `package.json` scripts, also run `/doc-review` (defaults to the diff) as a read-only pass and apply any confirmed doc fixes on the same branch.
- **Code review skill**: medium by default and higher for anything touching `src/domain`, `adapters`, `src/application` (the former `/network` and `/state`); never low, which makes one pass over source hunks and skips tests and docs. Always pass the target: without it the skill picks its own diff command, and on a pushed branch `git diff @{upstream}...HEAD` is empty ([anthropics/claude-code#63048](https://github.com/anthropics/claude-code/issues/63048)). If it answers `(none)` or finds nothing within seconds, check in its transcript that it read a non-empty diff, and rerun with the target if not. The skill is built into Claude Code and is not versioned here.
- **Automated feedback**: before asking about the merge, read what GitHub itself says about the PR, wait until the checks have finished (CodeQL and the other bots comment only after a push), and treat each item as a review finding: fix it as a follow-up commit, or answer it with the reason. A green `ci-passed` does not mean there is nothing to read.
  ```sh
  gh pr checks <n> --watch                             # block until the checks have finished
  gh api repos/cfisch3r/estimate/pulls/<n>/comments   # inline comments, including bots
  gh pr view <n> --json reviews,comments               # review bodies and conversation
  gh api "repos/cfisch3r/estimate/code-scanning/alerts?pr=<n>&state=open"
  ```
- **Merge gate**: always ask the user whether they want to personally review the PR before merging — even after the automated review comes back clean (a review that read no diff is not a clean review) and the automated feedback has been read and answered. Never auto-merge without asking.
- **Tracking**: plain GitHub issues — the Developer names the one to work on next; see [Picking the next task](#picking-the-next-task). The `EstiMate Roadmap` GitHub Project board is being retired. Milestones are retired (closed `M0`–`M3` kept as history).

## Concept docs & diagrams

Technical concept / architecture write-ups live in `docs/technical/concepts/`. Keep them
short and diagram-driven — several complementary views (component, sequence, state
machine, screen flow), not long prose. Prefer tables and diagrams over paragraphs.

Domain concept docs (`docs/domain/concepts/`) and the PRD (`docs/domain/prd.md`) follow a
different convention — process (numbered steps per mode/flow, or a diagram + table per the
two carve-outs below), information model (an entity/value-object table, or a commented YAML
block when per-field types/constraints are worth stating — see "YAML information models"
below), and rules (a table of guards/invariants) — since there are no components or source
directories to draw lanes from. `docs/domain/concepts/live-collaboration.md` and
`docs/domain/concepts/estimation-method.md` are the reference examples. A plain Mermaid
diagram of the process itself (flowchart or state diagram, no C4 box labels, no lanes) may
sit alongside the numbered steps when it helps readability — see PRD §4 for the combined
Live/Manual flow — but it never replaces the prose steps, and role/responsibility detail
stays in a table below it, not in the diagram. Two carve-outs stand the diagram + table up
on its own, without numbered prose steps:
- **Pure navigation/structure**, no decision logic (no branching per mode, nothing a
  numbered list would add) — a screen flow, for instance.
  `docs/domain/concepts/screen-flow.md` is that reference example; it uses a UML state
  diagram (screens as states, `«Screen»`/`«Screen State»` stereotypes) since screens-as-states
  is the more precise notation for pure navigation, not a flowchart.
- **A linear, non-branching process with several named steps**, where seeing the step order
  at a glance earns the diagram even without any branching to justify it — gate on "does
  seeing the steps in order help," not on "does it branch."
  `docs/domain/concepts/estimation-method.md`'s Process section is that reference example
  (aggregate → compute CI → guard → finalize).

Prose lists of several short, independent points (goals, non-goals, NFRs, open questions,
future phases) use a bold 2-4 word headline per item followed by `<br>` (not two trailing
spaces — those are invisible in a diff) and the detail sentence indented below it, instead
of a bare bullet of full sentences; this lets a reader scan for the headline that matters to
them. `docs/domain/prd.md` §§2-3, 6-8 are the reference examples. The same bolding — of the
few nouns that matter, not the whole cell — applies inside a long table cell.

### YAML information models

An entity/field table may instead be a commented YAML block — each entity a top-level key,
each field its own key with its type as the value (`likely: number`), validation constraints
and notes as `#` comments — when the entity has per-field types/constraints worth stating;
see `docs/domain/concepts/estimation-method.md`'s Information model. A flat enumeration of
data rows with several numeric columns to compare side-by-side (e.g. the five
cone-of-uncertainty levels in that same doc) still reads better as a table — don't convert
that too. Field names here must match the actual source identifiers (the real
type/const in `src/`), not an independently-invented label.

Diagram conventions below are for technical concept docs only (all Mermaid):

- **Component views**: use C4-style box labels — `Name` on line 1, `[type]` on line 2 (e.g.
  `[React Component]`, `[Zustand Store]`, `[Factory Function]`) — but draw them as a
  `flowchart`, **not** Mermaid's native `C4Component` type (its auto-layout and arrow routing
  are too messy here).
- Put each component's **responsibilities in a table below the diagram**, never inside the
  boxes.
- Group nodes into subgraph **"lanes"** (usually by source directory; "lane" is the drawing term only,
  architecture is described in "layers", see `docs/glossary.md`). Each lane gets an
  UPPERCASE title, a light background tint, and member nodes coloured to match via
  `classDef` / `class` — no emoji in lane titles or anywhere else in a diagram. Use
  `direction LR` inside multi-node lanes. External systems stay outside all lanes with a
  dashed border.
- **Legend above every diagram**: solid line = synchronous call, dotted = async
  callback/event/read, `<-->` = bidirectional. Label edges with what crosses them.
- Collapse many parallel edges (e.g. store → each screen) into one edge pointing at the lane.

`docs/technical/concepts/collaboration-mode.md` is the reference example.
