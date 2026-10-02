# ADR-008: Accessibility Testing Strategy

**Status:** Accepted
**Date:** 2026-10-01
**Related:** [002-testing-strategy.md](002-testing-strategy.md), issue #123

## Context

An accessibility audit found the app had no automated accessibility checking
anywhere in the stack: no lint rules for ARIA/semantics correctness, no
automated WCAG scan at the component or page level, and no documented
supported-browser matrix. Two real keyboard-accessibility bugs
(`SessionSidebar`'s clickable `div`, `EditableTitle`'s clickable `<h1>`) and a
missing-focus-management bug in `InfoPopover` existed undetected as a direct
consequence.

The repo already has a working pattern for this exact shape of problem:
Steiger + oxlint catch FSD architecture violations mechanically, and the
`architecture-review` subagent catches the judgment calls those tools
structurally can't make (ADR-004). Accessibility splits the same way.

## Decision

**A three-layer automated stack, each riding an existing CI job — no new job
required:**

1. **oxlint's `jsx-a11y` plugin** (`.oxlintrc.json`) — static ARIA/semantics
   rules (missing labels, invalid roles, non-interactive elements with click
   handlers, etc.). Enforced via the existing `lint` CI job.
2. **`jest-axe`** scans in component test files (`src/setupTests.ts` wires
   `toHaveNoViolations` into vitest's `expect`) — a real accessibility-tree
   scan of each component's rendered jsdom output. Enforced via the existing
   `test` CI job. `color-contrast` is disabled in these scans: jsdom does no
   real layout or font-metric computation, so the rule can't evaluate
   correctly there.
3. **`@axe-core/playwright`** scans in `e2e/specs/accessibility.spec.ts`,
   covering the app's main screens in a real browser — the only layer that
   can evaluate `color-contrast` and other layout-dependent rules at all.
   Enforced via the existing (blocking) `e2e` CI job.

**`color-contrast` is disabled in the e2e layer too, for now** — not because
jsdom's limitation applies there, but because Nocturne's `.text-muted` token
(`color-mix(in srgb, var(--color-text) 55%, transparent)`) measures 4.49:1
against the app background, just under WCAG AA's 4.5:1, and is used
throughout the app. `src/design/nocturne.css` is a verbatim, unmodified port
of the design system's canonical stylesheet (see AGENTS.md's code
conventions) — this codebase doesn't patch it locally for an app-specific fix.
Filed as #123; the exclusion in `e2e/helpers.ts`'s `expectNoA11yViolations`
points back at it.

**A fourth layer — a read-only `accessibility-review` subagent** mirroring
`architecture-review` — is planned as a follow-up PR to catch what none of
the above can: whether a *chosen* ARIA pattern is actually appropriate (not
just valid), focus-order sanity after a state change, whether dynamic content
needs a live region, and contrast judgment calls the e2e layer's narrowed
scan doesn't cover.

*Established pattern (2026-10):* the review's live-region and focus-order calls now
have a shared answer. `shared/ui`'s `LiveRegion` is rendered persistently and only its
children change (a region that mounts already holding text is announced
inconsistently), with `status` for progress and `alert` only for failures that need
action; `useFocusHeadingOnChange` hands focus to the new panel's heading when a view
replaces the control that had it.

## Rationale

- Mirroring the Steiger/oxlint + `architecture-review` split keeps the
  mental model consistent: mechanical tools catch what's mechanically
  checkable, a review subagent catches what requires judgment.
- No new CI job is needed because `lint`/`test`/`e2e` already exist and are
  already blocking — adding checks to them is strictly additive enforcement,
  not new infrastructure.
- Excluding `color-contrast` rather than either (a) leaving it enabled and
  blocking every future PR on a pre-existing, out-of-scope design-system gap,
  or (b) silently passing with no record, makes the gap visible and tracked
  without turning an unrelated accessibility-tooling PR into a design-system
  change.

## Consequences

**Positive**

- Every PR touching an interactive component now gets mechanical
  ARIA/semantics checking (oxlint) and a real accessibility-tree scan
  (jest-axe) for free, plus real-browser coverage of the app's main screens
  on every e2e run.
- The three-layer split means a future contributor fixing a jsdom-only
  limitation (e.g. upgrading to a browser-mode test runner) doesn't have to
  touch the e2e layer, and vice versa.

**Negative / accepted trade-offs**

- `color-contrast` is not enforced anywhere today — neither jsdom (can't)
  nor the real-browser e2e layer (deliberately excluded pending #123). This
  is a real, accepted gap, not an oversight: re-enabling it blindly would
  immediately fail CI on the pre-existing Nocturne token issue.
- The e2e accessibility spec only covers the screens it explicitly visits
  (mode-select, join-session, single-user workspace, collaborative
  workspace + participant view) — a new screen doesn't automatically get
  scanned until a test is added for it.

**Follow-ups / revisit triggers**

- Once #123 (Nocturne's `.text-muted` contrast) is fixed upstream, remove
  the `color-contrast` exclusion from `e2e/helpers.ts`'s
  `expectNoA11yViolations` and confirm the suite passes clean.
- Add the `accessibility-review` subagent (mirroring `architecture-review`)
  and wire it into AGENTS.md's PR-workflow paragraph, scoped to PRs touching
  interactive `src/` UI.
- If the e2e accessibility spec's screen coverage falls behind as new
  screens ship, extend it rather than relying on the component-level
  jest-axe scans alone — those can't catch layout-dependent rules.

## Alternatives considered (summary)

| Option | Rejected because |
|---|---|
| Switch component tests from jsdom to `@vitest/browser` to get real `color-contrast` checking at the component level | A testing-strategy change affecting all existing component tests, not just accessibility — its own ADR-level decision (and its own migration risk), not something to fold into an accessibility PR; real-browser e2e coverage of actual rendered screens is also more trustworthy for contrast than an isolated component render missing its page context |
| Leave `color-contrast` enabled in the e2e scan and let it fail until #123 is fixed | Blocks every future PR on a pre-existing, unrelated design-system gap this PR didn't introduce and isn't scoped to fix |
| Patch `.text-muted`'s opacity locally in app code | `nocturne.css` is a verbatim design-system port; the fix belongs in the design system, not a local override that drifts from the documented source |
