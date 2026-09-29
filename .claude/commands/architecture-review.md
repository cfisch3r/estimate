---
description: Review the diff (or a path) for FSD architecture judgment calls Steiger/oxlint can't make — slice placement, public-API quality, slice cohesion, component/hook design smells, cross-cutting composition placement. Read-only — reports severity-ranked findings, applies nothing.
argument-hint: "[all | <path>]"
---

Run an architecture review by delegating to the `architecture-review` subagent. This
is a read-only audit — it reports findings and does not edit code.

## Resolve the scope from `$ARGUMENTS`

- **empty** → **diff mode** (default). Gather the diff and hand it to the subagent:
  - If the branch is not `main` and has commits ahead of it, use `git diff main...HEAD`
    plus `git diff` for uncommitted changes.
  - Otherwise use `git diff HEAD` (uncommitted working-tree changes).
  - If the diff is empty, tell the user there's nothing to review and stop.
- **`all`** → **full-audit mode**. The subagent reviews the whole `src/` tree.
- **anything else** → treat it as a **path** (file or directory). Confirm it exists;
  the subagent reviews only that.

## Delegate

Spawn the `architecture-review` subagent (subagent_type: `architecture-review`) with:

- the resolved scope (diff / all / path),
- for diff mode, the diff text (or instruct it which `git diff` to run),
- a reminder to run `steiger ./src` and `oxlint src` itself first and never restate
  either tool's own findings — its report is judgment calls only.

## Relay

Present the subagent's findings to the user as-is, most-severe first, with the
severity count. Do not apply fixes. If the user wants a finding fixed, do it as a
normal follow-up edit after they say so.
