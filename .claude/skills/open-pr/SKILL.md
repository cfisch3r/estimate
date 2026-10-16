---
name: open-pr
description: Open the pull request for the current branch with a Review guide at the end of its body (risk, hot spots, skim-only files, what could not be verified) below a short description. Use whenever you are about to run `gh pr create`, when the user asks to update the Review guide of an open PR, or when a PR body changes.
---

# Open a Pull Request

Create the pull request for the current branch, or update its body. The body has two parts: a concise description first, so a reader understands why the change exists and the shape of the implementation, and the **Review guide** at the end, written by scripts from the risk catalogue (`docs/review-risk.md`), so a reader sees where to spend attention. The view conventions (diff blocks, trees, Mermaid) come from `../show-me/SKILL.md`.

## Where things run

Run every `pnpm` command in the repository root. Keep every temporary file in the scratchpad directory and refer to it by absolute path (`$S` below). A file inside the repository is an untracked change and would alter the floor.

## Before you start

- Stop if the branch is `main`, has no commits ahead of `main`, or has uncommitted changes. Commit first (AGENTS.md: never commit to `main`, one branch per issue `issue-<n>-<slug>`, new commits over amending).
- Stop and tell the user if a different pull request of the user's is already open, unless it is release-please's. The user wants one open at a time. Continue only if they ask for it. The open pull request of this very branch is the one you are updating, and only at the user's request (see *Updating the guide*).
- Push the branch with upstream. The guide covers the local `HEAD`, so push first and do not commit again until step 5 is done.

## Workflow

1. **Describe the change.** Read `references/pr_description_template.md`, gather only the context needed (the linked issue, the complete diff, `gh pr view` when a PR exists), and write the description to `$S/desc.md` using the template. The title must be a Conventional Commit (`feat: ...`, `fix: ...`, `docs: ...`); it becomes the squash commit and drives release-please. Issue-sized work puts `Closes #n` in the description. Mermaid diagrams must render on GitHub: explicit text colours, short edge labels. No AI attribution lines in the body (AGENTS.md).

2. **Rate the risk.** Unless the user asked to skip the guide (see below):
   - `pnpm review:floor > $S/floor.json` and `pnpm review:signals > $S/signals.json`. The signals run the unit tests, so allow a minute; a section that cannot run says "not available" and is fine.
   - Spawn the `risk-review` subagent (subagent_type: `risk-review`) for the branch. Save its single JSON reply to `$S/agent.json`. It may raise the floor and never lower it; do not edit its answer.

3. **Write the guide into the body.**
   - New PR: `pnpm review:guide --floor $S/floor.json --signals $S/signals.json --agent $S/agent.json --body $S/desc.md > $S/final.md`.
   - Existing PR (an update the user asked for): `gh pr view <n> --json body --jq .body > $S/prev.md`, then the same command with `--body $S/prev.md`, so the script replaces the old guide. If the description changed, replace everything outside the guide block in `final.md` with `$S/desc.md` and keep the block where it is (an older PR has it at the top, a newer one at the end). If the title no longer fits, use `gh pr edit <n> --title`.
   - Never write or edit the guide by hand.

4. **Check it.** `pnpm review:check-guide --body $S/final.md` must pass. If it fails, run steps 2 and 3 again and never edit the guide to satisfy the check.

5. **Publish.**
   - New PR: `gh pr create --title "<conventional title>" --body-file $S/final.md`.
   - Existing PR: `gh pr edit <n> --body-file $S/final.md`, then confirm it succeeded.

6. **Report** using `references/describe_pr_final_answer.md`.

## Skipping the guide

Only when the user asks for it, for a trivial pull request. Put this line at the end of the body, with their reason in their words, and skip steps 2 to 4 (the check accepts it):

```text
Review guide: skipped (typo fix in one doc)
```

## Updating the guide

The guide is written once, when the PR opens, and describes that commit (the `Covers:` marker). Pushing more commits does not make it stale and needs no check. Run the steps again only when the user asks to update the guide of an open PR: push first, then steps 2 to 5 with the PR's current body. The new guide replaces the old one; nothing compares them. `pnpm review:check-guide --pr <n>` shows on request whether the branch's floor has outgrown the guide.

Write as one human talking to another: avoid jargon and slang, and use simple, coherent, concise language.
