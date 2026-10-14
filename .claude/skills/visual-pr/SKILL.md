---
name: visual-pr
description: Only use when the user explicitly invokes this skill by name.
---

# Describe a Pull Request

Create or update the pull request for the current branch with a concise description that helps a reviewer understand why the change exists and the shape of the implementation. The view conventions (diff blocks, trees, Mermaid) come from `../show-me/SKILL.md`.

## Workflow

1. Read the template: `references/pr_description_template.md`.

2. Identify or create the pull request:
   - Check for a PR with `gh pr view --json url,number,title,state,baseRefName,headRefName 2>/dev/null`.
   - If none exists, inspect `git status --short --branch` and the branch's commits. Follow AGENTS.md: never commit to `main`, one branch per issue (`issue-<n>-<slug>`), push with upstream, open the PR.
   - The PR title must be a Conventional Commit (`feat: ...`, `fix: ...`, `docs: ...`); it becomes the squash commit and drives release-please.
   - Issue-sized work puts `Closes #n` in the description.

3. Gather only the context needed to explain the change:
   - The linked issue and the complete PR diff, plus enough surrounding code to understand behavior and ownership.
   - `gh pr view` for metadata and changed files.
   - `../show-me/SKILL.md` for the view conventions.

4. Write the description using the template:
   - **Why the change**: exactly one sentence.
   - **Special things to note**: 1-3 bullets (reviewer warnings, compatibility constraints, deliberate omissions, surprising decisions), or `- None.`.
   - **Change outline**: a compact structural view, not prose or a file-by-file changelog. Use only the views that help: key type changes, pseudocode for changed behavior, a shallow file tree, a component tree, call/data flow. Prefer `diff` blocks for changes to existing shapes; show the complete shape when most of it is new.
   - Mermaid diagrams must render on GitHub: explicit text colours, short edge labels.
   - No AI attribution lines in the body (AGENTS.md).

5. Publish the description:
   - Write the body to the scratchpad directory, then `gh pr edit {number} --body-file {path}` and confirm it succeeded.

6. Report using `references/describe_pr_final_answer.md`.

Write as one human talking to another: avoid jargon and slang, and use simple, coherent, concise language.
