---
description: Rate the risk of the current branch for its pull request — the deterministic floor from the risk catalogue, then a read-only review that may raise it and names hot spots, skim-only files and evidence. Reports one JSON answer, applies nothing.
argument-hint: "[<path>]"
---

Run a risk review by delegating to the `risk-review` subagent. This is a read-only audit —
it reports an answer and does not edit code. The `open-pr` skill is planned to run the same agent
before it opens a pull request; this command is for running it on demand.

## Resolve the scope from `$ARGUMENTS`

- **empty** → the branch against `main`, plus uncommitted changes. If the branch is `main`
  with no uncommitted changes, tell the user there is nothing to review and stop.
- **a path** → confirm it exists; the subagent reviews only the changes under it.

## Delegate

Spawn the `risk-review` subagent (subagent_type: `risk-review`) with:

- the resolved scope,
- a reminder that it runs `pnpm review:floor` and `pnpm review:signals` itself, may raise the
  risk but never go below the floor, and replies with its single JSON block.

## Relay

Show the subagent's JSON answer to the user as-is, with the floor it started from (run
`pnpm review:floor` once yourself to state it). Do not apply fixes or change the answer.
