---
name: accessibility-review
description: Review the diff (or a path) for accessibility judgment calls oxlint's jsx-a11y plugin and the jest-axe/axe-core scans can't make — ARIA pattern appropriateness, focus-order sanity, live-region needs, contrast judgment calls outside the e2e scan's scope. Read-only — reports severity-ranked findings, applies nothing.
argument-hint: "[all | <path>]"
---

Run an accessibility review by delegating to the `accessibility-review:reviewer` agent.
This is a read-only audit — it reports findings and does not edit code.

## Resolve the scope from `$ARGUMENTS`

- **empty** → **diff mode** (default). Gather the diff and hand it to the agent:
  - If the branch is not `main` and has commits ahead of it, use `git diff main...HEAD`
    plus `git diff` for uncommitted changes.
  - Otherwise use `git diff HEAD` (uncommitted working-tree changes).
  - If the diff is empty, tell the user there's nothing to review and stop.
- **`all`** → **full-audit mode**. The agent reviews the whole `src/` tree.
- **anything else** → treat it as a **path** (file or directory). Confirm it exists;
  the agent reviews only that.

## Delegate

Spawn the accessibility reviewer (subagent_type: `accessibility-review:reviewer`). If that agent type does not exist, the `accessibility-review` plugin is not loaded (an untrusted folder, a session started before the checkout): stop and say so instead of reviewing without it. Give it:

- the resolved scope (diff / all / path),
- for diff mode, the diff text (or instruct it which `git diff` to run),
- a reminder to run `pnpm lint` itself first and never restate a `jsx-a11y` finding
  it already reported — its report is judgment calls only (see
  docs/adr/008-accessibility-testing-strategy.md for what each automated layer
  already covers).

## Relay

Present the agent's findings to the user as-is, most-severe first, with the
severity count. Do not apply fixes. If the user wants a finding fixed, do it as a
normal follow-up edit after they say so.
