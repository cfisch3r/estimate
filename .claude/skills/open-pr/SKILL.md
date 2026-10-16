---
name: open-pr
description: Open or update the pull request for the current branch with a Review guide at the top of its body (risk, hot spots, skim-only files, evidence) and a short description below. Use whenever you are about to run `gh pr create` or change a PR body, and before pushing more commits to an open PR that touches risk-relevant files.
---

# Open a Pull Request

Create or update the pull request for the current branch. The body has two parts: the **Review guide** at the top, written by scripts from the risk catalogue (`docs/review-risk.md`), so a reader sees where to spend attention, and a concise description below, so a reader understands why the change exists and the shape of the implementation. The view conventions (diff blocks, trees, Mermaid) come from `../show-me/SKILL.md`.

Use the scratchpad directory for every temporary file below.

## Before you start

- Stop if the branch is `main`, has no commits ahead of `main`, or has uncommitted changes. Commit first (AGENTS.md: never commit to `main`, one branch per issue `issue-<n>-<slug>`, new commits over amending).
- Stop and tell the user if another pull request of the user's is already open, unless it is release-please's. The user wants one open at a time. Continue only if they ask for it.
- Push the branch with upstream. The guide covers the pushed head commit.

## Workflow

1. **Describe the change.** Read `references/pr_description_template.md`, gather only the context needed (the linked issue, the complete diff, `gh pr view` when a PR exists), and write the description to `body.md` using the template. The title must be a Conventional Commit (`feat: ...`, `fix: ...`, `docs: ...`); it becomes the squash commit and drives release-please. Issue-sized work puts `Closes #n` in the description. Mermaid diagrams must render on GitHub: explicit text colours, short edge labels. No AI attribution lines in the body (AGENTS.md).

2. **Rate the risk.** Unless the user asked to skip the guide (see below):
   - `pnpm review:floor > floor.json` and `pnpm review:signals > signals.json`. The signals run the unit tests, so allow a minute; a section that cannot run says "not available" and is fine.
   - Spawn the `risk-review` subagent (subagent_type: `risk-review`) for the branch. Save its single JSON reply to `agent.json`. It may raise the floor and never lower it; do not edit its answer.

3. **Write the guide into the body.** `pnpm review:guide --floor floor.json --signals signals.json --agent agent.json --body body.md > final.md`. For an existing PR, pass its current body as `--body` (`gh pr view <n> --json body --jq .body > body.md` first, then replace only the description part if it changed) so the script adds the "Since last version" block. Never write or edit the guide by hand.

4. **Check it.** `pnpm review:check-guide --body final.md` must pass. If it fails, fix the cause (usually: run the steps again on the pushed head) and never edit the guide to satisfy the check.

5. **Publish.**
   - New PR: `gh pr create --title "<conventional title>" --body-file final.md`.
   - Existing PR: `gh pr edit <n> --body-file final.md`, then confirm it succeeded.

6. **Report** using `references/describe_pr_final_answer.md`.

## Skipping the guide

Only when the user asks for it, for a trivial pull request. Put this line first in the body, with their reason in their words, and skip steps 2 to 4 (the check accepts it):

```text
Review guide: skipped (typo fix in one doc)
```

## Updating an open PR

Before pushing more commits to an open PR, run `pnpm review:check-guide --pr <n>` on its branch. If it says the guide is out of date, run steps 2 to 5 again after the push, with the PR's current body as `--body`. A change that only touches documentation does not make a guide stale.

Write as one human talking to another: avoid jargon and slang, and use simple, coherent, concise language.
