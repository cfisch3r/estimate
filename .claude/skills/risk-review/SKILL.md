---
name: risk-review
description: Build the Review guide of the current branch as a private artifact — the deterministic floor from the risk catalogue, then a read-only review that may raise it and names hot spots and skim-only files and says what it could not verify. Changes no code.
---

Build the Review guide for the branch the user is reviewing. The guide describes the branch as
it is now; run the command again after new commits to get a new one.

## Scope

The branch against the base branch (`origin/main`, else `main`), plus uncommitted and
untracked changes. If the branch is `main` with no uncommitted changes, tell the user there is
nothing to review and stop. Stop as well, and say so, when the working tree has uncommitted changes
or the branch is not pushed: the page links its hot spots to the commit it covers, so that
commit must be the pushed `HEAD`. The floor and signals scripts always cover the whole branch, so
there is no path scope. Run every `pnpm` command in the repository root and keep every
temporary file in the scratchpad directory (`$S` below, an absolute path): a file inside the
repository would change the floor.

## Steps

1. `pnpm review:floor > $S/floor.json` and `pnpm review:signals > $S/signals.json`. The signals
   run the unit tests, so allow a minute; a section that cannot run says "not available" and is fine.
2. Spawn the risk reviewer (subagent_type: `risk-review:reviewer`). If that agent type does not
   exist, the `risk-review` plugin is not loaded (an untrusted folder, a session started before
   the checkout): stop and say so instead of building a guide without it. Remind the agent that it runs
   both scripts itself, may raise the risk but never go below the floor, and replies with its
   single JSON block. Save the reply to `$S/agent.json`. Do not edit the answer.
3. `pnpm review:guide --floor $S/floor.json --signals $S/signals.json --agent $S/agent.json --title "Review guide PR <n>" > $S/guide.html`
   (use the number of the branch's open pull request from `gh pr view --json number`; without
   one, `--title "Review guide <branch>"`). Never write or edit the page by hand.
4. Publish `$S/guide.html` as an artifact. If an artifact with that title already exists
   (`Artifact` with `action: "list"`), read it once (`action: "read"`), then publish the freshly
   generated `$S/guide.html` with its `url` so the link stays the same; otherwise it is a new
   private one. Pass a short `description` and the icon `shield`.

## Report

Give the link, then in a few lines: the risk (and the floor if it was raised), the categories,
and the headline of each hot spot. Say that the page describes the commit it names, and that
the command can be run again after new commits.
