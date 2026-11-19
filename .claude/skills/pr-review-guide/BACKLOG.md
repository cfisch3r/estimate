# Review guide backlog

Ideas for the Review guide plugin that are not planned yet. An entry with a link was a GitHub issue, now closed as "not planned"; the link keeps its full text and discussion. To pick one up, reopen its issue or open a new one, and remove the entry here.

## Review guide for a pull request that is not checked out

`/pr-review-guide <n>` builds the guide for pull request `n` in a temporary worktree at its head commit, without touching the Developer's checkout. The issue has a manual recipe that was tried on #199, and two open questions: which base branch to use, and whether to reuse `node_modules`. ([#218](https://github.com/cfisch3r/estimate/issues/218))

## Accessibility scan of the guide page, and three doc parts in scannable form

- An axe scan over a rendered guide page with a map and arrows, so that a map control losing its accessible name or state fails a test. ADR-008 then notes that the guide page is covered.
- Three older doc parts in the scannable form:
  - the guide rules
  - the catalogue category fields, as a commented YAML info model
  - the matching rules

([#216](https://github.com/cfisch3r/estimate/issues/216))

## Map read by keyboard and screen reader in the order it shows

- The map becomes a nested tree (row, folders, files), so the reading and tab order follow what the map shows.
- Fewer tab stops.
- Strip rows can be read in full without a mouse.
- A layer without slices (`app`) collapses when it is busy.

Two small cleanups can ride along: the subtree file count in `reviewMap.ts`, and the three parallel edges in the data-flow diagram. ([#210](https://github.com/cfisch3r/estimate/issues/210))

## Map shows untested changes and where else to look

- **Marks on a file:**
  - a T mark for changed lines that ran or did not run in a unit test;
  - "fix ×n" for repeated fix commits;
  - "complex" for a metrics hotspot.
- **An "Also worth a look" list:** up to five files that are not hot spots but carry at least two cues.
- **Check end to end** on #199.

([#208](https://github.com/cfisch3r/estimate/issues/208))

## Guide shows how the architecture changes

- **A summary above the map:**
  - new and removed layer dependencies;
  - new and removed slices;
  - new and removed slice dependencies;
  - public API changes.
- **On the map:** thick arrows for new or removed dependencies, and badges for new or removed slices.
- **An `architecture` section in the signals**, so the agent can make an unexpected dependency a hot spot.
- **Check end to end** on #199.

([#206](https://github.com/cfisch3r/estimate/issues/206))

## A manual without this project's tools

The plugin's manual (`.claude/skills/pr-review-guide/docs/`) still names files and tools of the project it came from, for example `pnpm metrics` and `pnpm audit` in the signals, `pnpm review:floor` in the flow, `vite.config.ts` and `tsconfig` files in the diff checks, `tsconfig.app.json` for the import edges, this project's layers and strips on the changeset map, `src/` in the agent's `responsibilities`, and the catalogue's path. They match the plugin's scripts today. A portable plugin would read them from the project settings, and the manual would describe them in general terms.
