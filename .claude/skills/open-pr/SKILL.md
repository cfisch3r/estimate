---
name: open-pr
description: Open the pull request for the current branch with a short description, or update its description. Reports the review floor of the branch. Use whenever you are about to run `gh pr create` or when a PR description changes.
---

# Open a Pull Request

Create the pull request for the current branch, or update its description. The body is a concise description, so a reader understands why the change exists and the shape of the implementation. It carries no review guide: the reader asks for one with `/risk-review` when reviewing (see `docs/review-risk.md`). The view conventions (diff blocks, trees, Mermaid) come from `../show-me/SKILL.md`.

## Where things run

Run every `pnpm` command in the repository root. Keep every temporary file in the scratchpad directory and refer to it by absolute path (`$S` below). A file inside the repository is an untracked change and would alter the floor.

## Before you start

- Stop if the branch is `main`, has no commits ahead of `main`, or has uncommitted changes. Commit first (AGENTS.md: never commit to `main`, one branch per issue `issue-<n>-<slug>`, new commits over amending).
- Stop and tell the user if a different pull request of the user's is already open, unless it is release-please's. The user wants one open at a time. Continue only if they ask for it. The open pull request of this very branch is the one you are updating.
- Push the branch with upstream.

## Workflow

1. **Describe the change.** Read `references/pr_description_template.md`, gather only the context needed (the linked issue, the complete diff, `gh pr view` when a PR exists), and write the description to `$S/desc.md` using the template. The title must be a Conventional Commit (`feat: ...`, `fix: ...`, `docs: ...`); it becomes the squash commit and drives release-please. Issue-sized work puts `Closes #n` in the description. Mermaid diagrams must render on GitHub: explicit text colours, short edge labels. No AI attribution lines in the body (AGENTS.md).

2. **Read the floor.** `pnpm review:floor > $S/floor.json` (no model, a few seconds) and note its `floor` and the names in `categories`.

3. **Publish.**
   - New PR: `gh pr create --title "<conventional title>" --body-file $S/desc.md`. A hook then shows the floor to the user; still name it yourself.
   - Existing PR: `gh pr edit <n> --body-file $S/desc.md`, then confirm it succeeded. If the title no longer fits, use `gh pr edit <n> --title`.

4. **Report** using `references/describe_pr_final_answer.md`. The first line of the answer is the floor from step 2 (risk and categories), before the link to the PR.

Write as one human talking to another: avoid jargon and slang, and use simple, coherent, concise language.
