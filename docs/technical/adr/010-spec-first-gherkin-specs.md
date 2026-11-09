# ADR-010: Spec-First Development with Executable Gherkin Specs

**Status:** Accepted
**Date:** 2026-11-09
**Related:** [002-testing-strategy.md](002-testing-strategy.md), [007-e2e-dual-mode-signaling.md](007-e2e-dual-mode-signaling.md), [glossary.md](../../glossary.md), AGENTS.md

## Context

Work in this repo has been picked from the **EstiMate Roadmap** GitHub Project board: a
two-level ordered backlog of epics and their sub-issues, walked by a fixed algorithm
("first open sub-issue of the first open epic"). That board is being retired. Issues
themselves aren't going away, but the Developer will name the next issue directly instead
of the agent querying the board for it — the selection algorithm this described no longer
matches how work is picked.

Separately, the Developer wants to develop features **spec-first** with AI agents: discuss
the scope, write a throwaway design artifact, write the scenario as a Gherkin feature (and
the code that drives it) and watch it fail for the right reason, and only then plan and
implement. The goal is an executable acceptance criterion that can't silently drift from
the implementation the way prose in an issue body can.

A time-boxed spike (`spike/bdd-specs`) tested feasibility by porting the existing
`e2e/specs/late-joiner-snapshot.spec.ts` to a `playwright-bdd`-generated `.feature` file:

- **Cost**: negligible. `bddgen` (regeneration) plus `playwright test` cost ~0.2s more than
  the existing spec alone (~2.4s vs ~2.2s, 5 runs each, cold and warm) — noise at one
  scenario. `bddgen` has no incremental/watch mode, so it re-parses every matching
  `.feature` file on every invocation; the cost curve past a handful of scenarios is
  unverified (see Follow-ups).
- **Fit**: clean. `playwright-bdd@9.2.1`'s peer dependency (`@playwright/test >=1.44`) is
  satisfied by the installed version. `defineBddConfig()` returns a `testDir` used by a
  second Playwright `project` entry alongside the existing `chromium` one — the existing
  `webServer`/relay/app wiring (ADR-007) needed no change. `bddgen` is a separate
  generation step, not hooked into `playwright test` itself, so it had to be wired into
  `test:e2e`/`test:e2e:ui`/`test:e2e:real-world` directly (`bddgen && playwright test`).
- **Actors**: clean. A named-actors fixture (`world.ts`) lazily creates one browser context
  per actor name and closes them at teardown, mirroring `e2e/fixtures.ts`'s role-fixture
  rationale. Step definitions (`steps.ts`) call only into `e2e/helpers.ts` — zero raw
  selectors in step text or step code.
- **Decoupling**: provable. A dependency-cruiser rule can forbid driver code from importing
  `src/` directly, and firing it on a planted violation (then removing it) confirmed the
  rule actually catches the case, not just that it exists in the config.
- **Failure quality**: distinguishable. A wrong-but-plausible assertion fails as an ordinary
  Playwright assertion error with file:line and a trace. A typo'd step fails at
  *generation* time — `bddgen` itself refuses, printing "Missing step definitions" with a
  ready-made snippet — before any browser even opens. A human or an agent can't confuse the
  two.

## Decision

**Adopt a `specs/<concept>/<test level>/` tree**, parallel to the concept name shared by
`docs/domain/concepts/` and `docs/technical/concepts/`: one concept folder per feature area
(here `live-session`), one subfolder per **Test Level** — what we call the kind of thing a
scenario drives (`e2e`: real UI in real browsers, real WebRTC through the local relay per
ADR-007). `protocol` and `domain` Test Levels are deferred until a scenario actually needs
one; we call this a "Test Level" rather than a "layer" to avoid colliding with the
architecture layer and FSD layer vocabulary already defined in
[glossary.md](../../glossary.md).

**One scenario, one Test Level.** No scenario runs on more than one Test Level, and there is
no shared DSL/interface across Test Levels yet — each Test Level owns its own runner. The
`e2e` Test Level's is `playwright-bdd` on top of the existing Playwright setup; a future
`domain` Test Level would need a different one, since `src/domain` cannot depend on
Playwright, a browser, or anything else outside itself (`pure-domain`, see
[architecture-rules.md](../architecture-rules.md)).

**`e2e` Test Level conventions**, as validated by the spike:
- `.feature` files are declarative, in domain language ("Jordan joins the session"), never
  UI words ("clicks Join"); actors are named, never "I".
- `steps.ts` (step text → actor actions) and `world.ts` (the named-actors fixture) sit next
  to the `.feature` file. Step code calls only into `e2e/helpers.ts` — no raw selectors.
- Generated test files go into gitignored `.features-gen/`.
- `specs/*/e2e/**` may not import from `src/` — enforced by the
  `specs-e2e-no-src-import` dependency-cruiser rule (`.dependency-cruiser.specs.cjs`,
  `pnpm arch:specs`), so a spec can never quietly start depending on implementation
  internals instead of observable behavior.

**New workflow steps**, replacing the retired board-walking algorithm in AGENTS.md's
"Picking the next task": the Developer names the issue directly; the agent still fetches
and summarizes *that* issue, flags ambiguities, and stops for an explicit go-ahead, exactly
as before. Once given, two further steps are offered — **asked explicitly every time,
never assumed, both optional**:

1. **Before branching** — write a design artifact for the story, published with the
   Artifact tool. It is **ephemeral**: kept only for the duration of implementing that one
   story, never committed as a file. Anything worth keeping afterward is folded into the
   permanent docs (a concept doc, an ADR, `architecture.md`) — the artifact itself is
   discarded once the story ships.
2. **After branching, before planning or implementation** — write the scenario(s) as a
   `.feature` file (plus driver code) at the appropriate Test Level, generate it, and
   confirm it fails for the right reason before any implementation code is written.

## Rationale

- An executable `.feature` file is an acceptance criterion that fails loudly when the
  implementation doesn't match it; prose in an issue body can drift from the code with
  nothing to notice.
- Making both new steps asked rather than default-on or silently skipped matches this
  repo's existing "ask, don't assume" collaboration style (AGENTS.md's own go-ahead gate) —
  there's zero forced overhead on a small, unambiguous story, while the option stays
  available for one that needs it.
- An ephemeral Artifact for the design step avoids inventing a new "one doc per story"
  convention that nobody would ever prune — the domain and technical concept docs and the
  ADRs stay the only durable home for design knowledge, matching this repo's existing
  docs-hygiene practice.
- One Test Level per scenario, no shared DSL yet, is deliberately conservative: a shared
  interface across Test Levels would be speculative generality with no second Test Level
  yet to validate it against.
- Removing the board-walking algorithm reflects an actual change in how work is tracked,
  not a process preference — keeping it in AGENTS.md after the board is gone would describe
  a workflow that no longer exists. GitHub epics (as a label/ordering concept) are left
  alone: their fate is undecided and is independent of this decision.

## Consequences

**Positive**
- The approach is validated cheaply (one real scenario, measured cost, proven decoupling
  rule, proven failure-quality distinction) before being adopted repo-wide.
- Both new workflow steps carry zero cost on stories that don't need them.
- The decoupling rule keeps `e2e` specs honest as black-box scenarios even as `src/` is
  refactored underneath them.

**Negative / accepted trade-offs**
- Each future Test Level needs its own runner and its own wiring — there is no shared
  harness across Test Levels, so adding one is real setup work, not just a new folder.
- `bddgen` re-parses its entire `features` glob on every invocation; no incremental mode
  was found. Negligible today; unverified past a handful of scenarios.
- The ephemeral design artifact's value depends on actually folding anything worth keeping
  into the permanent docs before it's discarded — nothing enforces that.
- The manual canary proof for `specs-e2e-no-src-import` (plant a violating import, see it
  fail, remove it) is not a committed test, unlike `scripts/layerRules.test.ts`'s
  equivalent for the `src/` layer rules — acceptable with one rule and no exceptions yet.

**Follow-ups / revisit triggers**
- Revisit `bddgen`'s generation cost once the `e2e` Test Level holds more than a handful of
  scenarios.
- Revisit "no shared DSL across Test Levels" once a second Test Level (`protocol` or
  `domain`) actually exists.
- Promote the `specs-e2e-no-src-import` canary to a committed test (mirroring
  `scripts/layerRules.test.ts`) once there's a second rule or an allowed exception to
  protect.
- Decide the fate of GitHub epics separately; this ADR only removes the automated
  board-walking selection AGENTS.md used to do.

## Alternatives considered (summary)

| Option | Rejected because |
|---|---|
| Keep specs as plain prose in GitHub issues | Drifts from the code silently; nothing fails when the prose and the implementation disagree |
| One shared DSL/interface across Test Levels from day one | Speculative generality — no second Test Level exists yet to validate the abstraction against |
| Cucumber directly, without the Playwright runner, for `e2e` | Loses Playwright's own fixture/trace/`webServer` machinery that `e2e/fixtures.ts` and `playwright.config.ts` already provide; `playwright-bdd` converts Gherkin into native Playwright tests instead of replacing the runner |
| A committed per-story design doc under `docs/` | Needs a pruning convention nobody asked for; the Artifact tool already gives ephemeral, shareable scratch space, with the permanent docs as the durable home for anything worth keeping |
| Keep the GitHub Project board as the source of task order | Being retired independently of this decision; irrelevant to keep describing a workflow that no longer exists |
