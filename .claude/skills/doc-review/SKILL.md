---
name: doc-review
description: Audit the repo's documentation for accuracy, cross-reference integrity, and convention conformance. Reviews docs implicated by the current diff by default; `all` for a full audit, or pass a path. Read-only — reports severity-ranked findings, applies nothing.
argument-hint: "[all | <path>]"
---

Run a documentation quality review by delegating to the `doc-review:reviewer` agent. This is a read-only audit — it reports findings and does not edit docs.

## Resolve the scope from `$ARGUMENTS`

- **empty** → **diff mode** (default). Gather the diff and hand it to the agent:
  - If the branch is not `main` and has commits ahead of it, use `git diff main...HEAD` plus `git diff` for uncommitted changes.
  - Otherwise use `git diff HEAD` (uncommitted working-tree changes).
  - If the diff is empty, tell the user there's nothing to review and stop.
- **`all`** → **full-audit mode**. The agent reviews every file in `docs/`, plus `README.md` and `AGENTS.md`.
- **anything else** → treat it as a **path** (file or directory). Confirm it exists; the agent reviews only that.

## Delegate

Spawn the doc reviewer (subagent_type: `doc-review:reviewer`). If that agent type does not exist, the `doc-review` plugin is not loaded (an untrusted folder, a session started before the checkout): stop and say so instead of reviewing without it. Give it:

- the resolved scope (diff / all / path),
- for diff mode, the diff text (or instruct it which `git diff` to run),
- a reminder that its rubric is `AGENTS.md` + `docs/README.md` + the existing ADRs/concept doc, and that it must not use `gh`.

## Relay

Present the agent's findings to the user as-is, most-severe first, with the severity count. Do not apply fixes. If the user wants a finding fixed, do it as a normal follow-up edit after they say so.
