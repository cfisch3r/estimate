---
name: doc-review
description: Audit the repo's documentation across three angles — consistency (accuracy/cross-reference), quality (the plugin's own Definition of Good), and completeness (dropped content on structural edits, diff mode only) — fanned out to parallel agents and merged before relay. Reviews docs implicated by the current diff by default; `all` for a full audit, or pass a path. Read-only — reports severity-ranked findings, applies nothing.
argument-hint: "[all | <path>]"
---

Run a documentation quality review by delegating to three reviewer agents in parallel,
then merging and deduplicating their findings. This is a read-only audit — it reports
findings and does not edit docs.

## Resolve the scope from `$ARGUMENTS`

- **empty** → **diff mode** (default). Gather the diff and hand it to the agents:
  - If the branch is not `main` and has commits ahead of it, use `git diff main...HEAD`
    plus `git diff` for uncommitted changes.
  - Otherwise use `git diff HEAD` (uncommitted working-tree changes).
  - If the diff is empty, tell the user there's nothing to review and stop.
- **`all`** → **full-audit mode**. The agents review every file in `docs/`, plus
  `README.md` and `AGENTS.md`.
- **anything else** → treat it as a **path** (file or directory). Confirm it exists; the
  agents review only that.

## Pick the applicable agents for this scope

| Angle | Diff | All | Path |
|---|---|---|---|
| `doc-review:consistency-reviewer` | ✓ | ✓ | ✓ |
| `doc-review:quality-reviewer` | ✓ | ✓ | ✓ |
| `doc-review:completeness-reviewer` | ✓ | — | — |

The Completeness angle only runs in diff mode — there's no old-vs-new baseline to
inventory against in a full audit or a bare path, so don't spawn it for those scopes.

## Delegate

Spawn the applicable agents from the table above, **in parallel** (one message, multiple
Agent calls). If any expected agent type does not exist, the `doc-review` plugin is not
loaded (an untrusted folder, a session started before the checkout): stop and say so
instead of reviewing without it — don't silently fall back to fewer agents.

Give each agent:

- the resolved scope (diff / all / path),
- for diff mode, the diff text (or instruct it which `git diff` to run),
- a reminder that its rubric for *what makes a doc good* is this plugin's own
  `.claude/skills/doc-review/references/definition-of-good.md` (the Quality and
  Completeness angles' concern), while `AGENTS.md`/`docs/README.md` are read only for
  where a doc belongs, never as a quality standard (the Consistency angle's concern, which
  does read repo docs, but as ground truth about this repo's own code/doc state — not as
  a style rubric),
- a reminder that it must not use `gh`.

## Merge and deduplicate

Once all spawned agents report back, merge their findings yourself — don't relay three
separate lists:

- If two agents report a finding at the same `file:line` describing the same underlying
  problem (e.g. Consistency flags a stale cross-reference and Quality flags the same
  sentence as a hygiene violation), collapse them into one finding, keeping whichever
  wording is more specific.
- Everything else passes through unchanged.
- Re-sort the merged set most-severe first.

## Relay

Present the merged findings to the user as one list, most-severe first, with the combined
severity count. Do not apply fixes. If the user wants a finding fixed, do it as a normal
follow-up edit after they say so.
