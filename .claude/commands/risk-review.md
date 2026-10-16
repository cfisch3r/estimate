---
description: Rate the risk of the current branch for its pull request — the deterministic floor from the risk catalogue, then a read-only review that may raise it and names hot spots, skim-only files and evidence. Reports one JSON answer, applies nothing.
---

Run a risk review by delegating to the `risk-review` subagent. This is a read-only audit —
it reports an answer and does not edit code. The `open-pr` skill runs the same agent before it opens
a pull request; this command is for running it on demand.

## Scope

The branch against the base branch (`origin/main`, else `main`), plus uncommitted and
untracked changes. If the branch is `main` with no uncommitted changes, tell the user there is
nothing to review and stop. The floor and signals scripts always cover the whole branch, so
there is no path scope.

## Delegate

Spawn the `risk-review` subagent (subagent_type: `risk-review`) with:

- a reminder that it runs `pnpm review:floor` and `pnpm review:signals` itself, may raise the
  risk but never go below the floor, and replies with its single JSON block.

## Relay

Show the subagent's JSON answer to the user as-is, with the floor it started from (run
`pnpm review:floor` once yourself to state it). Do not apply fixes or change the answer.
