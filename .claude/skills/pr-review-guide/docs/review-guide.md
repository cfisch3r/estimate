# Review guide

## The agent's answer

The `pr-review-guide:reviewer` agent replies with one JSON object, which the guide script reads. The agent
runs both scripts itself, and a signal never makes a category or a hot spot on its own.

| Field | Content |
|---|---|
| `risk` | A [risk level](catalogue-format.md#risk-levels), at least the floor |
| `categories` | Names from the catalogue, including every category the floor found |
| `hotSpots` | Up to eight places to read closely, most important first: a `title` (a headline of about ten words), a `body` (what the change is and what makes it a hot spot), `file` and `line` (a line the change added or changed) and a `rule` (architecture rule, ADR number or catalogue category) |
| `skimOnly` | Files that can be skimmed, each with a `why`. A `file` ending in `/` is a folder, one with a wildcard a glob, any other a file or a folder written without the slash |
| `responsibilities` | For each changed file under `src/` that is not a test, a stylesheet, a type declaration or skim-only, a `file` and a [responsibility](../../../../docs/glossary.md) `text`: one sentence on what the file is for in the app, not what changed; possibly empty |
| `notVerified` | What a reader has to check by hand because the agent could not or did not: concrete, short, possibly empty |

## The review guide

The guide is built on request, when the maintainer reviews a branch: `/pr-review-guide` runs the
scripts and the agent and publishes the result as a private artifact. The pull request body
carries no guide. `pnpm review:guide` renders one self-contained HTML page from the inputs in the
[flow diagram](README.md#how-it-is-used). A script writes it, so the rules hold whatever the agent says:

- The risk is the higher of the floor and the agent's risk. A lower answer is ignored and noted
  under "Checked by the scripts".
- Categories are the floor's plus the catalogue names the agent added. Other names are dropped.
- A hot spot must be a line the change added or changed, up to eight. Others are dropped and
  noted. The floor script supplies the changed lines. Agent text is escaped, so it cannot add
  markup to the page.
- Each hot spot carries facts that the script adds from the signals, never the agent: "No test
  runs this line" when the changed-line coverage lists the line, and the number of `fix:` commits
  of the file in the last six months when it is two or more (the history signal lists only the
  ten files with the most fixes, so a file further down gets no fact). A line that coverage does not list
  may be covered or have no statement, so nothing is said about it.
- "Not verified" lists what a reader has to check by hand: the signals that could not run or have
  no data for a file, a warning when the script dropped hot spots or showed only eight of more
  (the guide then lacks content), then the agent's `notVerified` entries. What the scripts did measure, and
  what the script itself dropped or overrode, sits in a collapsed "Checked by the scripts" block
  below it.
- A hot spot links to its file and line at the commit the guide covers when the repository has a
  GitHub address (read from the `origin` remote); otherwise the reference is plain text.
- Each hot spot is numbered in the order the agent gave. When the changeset map draws its file,
  the same number sits on the file's box (or on the collapsed folder or strip row holding it), and
  a "Show on map" button opens the folders around the file, pins its box and moves focus to it.
- The map draws the changed files under a skim-only entry in the skim-only look, except a hot
  spot's file, and shows a responsibility only for a changed file drawn as a box and not
  skim-only; the other responsibilities are dropped without a note. See
  [What the page shows](changeset-map.md#what-the-page-shows).
- The changeset map is optional. When it cannot be built (missing or invalid `map` settings in
  `pr-review-guide.yaml`, or a failing read of the changed files), the page has no map and says why
  under "Not verified". Settings that are malformed as a whole stop the floor, and with it the guide.
- The page describes the commit it names. After new commits, run the command again; it
  publishes over the earlier artifact of the same pull request and nothing compares the two.

| Part | Content |
|---|---|
| Marker | `Covers <commit>`, the commit the guide was written for, so a reader can see what it describes |
| Risk | The level and the category names |
| Changeset map | The branch's changed files placed in the app's structure (since the floor's commit, when it had one), with the imports the change added and removed drawn as arrows, and the unchanged files that use a changed export; tests, CSS and type declarations only counted. See [Changeset map](changeset-map.md) |
| Hot spots | The number, a headline, what the change is and what makes it a hot spot, the reference (`file:line`, linked to the covered commit) with the rule or ADR and a "Show on map" button when the map draws the file, and facts from the signals |
| Skim only | Files a reader can skim, each with a reason |
| Not verified | What a reader has to check by hand; the scripts' own findings are folded below it |

Do not edit the page by hand; run the command again.

When a pull request opens, the agent reports the minimum risk and categories first in its answer. A `PostToolUse` hook on `gh pr create`
(`.claude/skills/pr-review-guide/hooks/posttooluse-floor.sh`) also shows the floor to the maintainer, so the report does not
depend on the agent. That costs seconds and no model, and it is the only automatic signal: the
guide itself exists only when the maintainer asks for it.
