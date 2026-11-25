# ADR-012: A Docs Website Built from `docs/` and `specs/`

**Status:** Accepted
**Date:** 2026-11-25
**Related:** [010-spec-first-gherkin-specs.md](010-spec-first-gherkin-specs.md), [runbook.md](../runbook.md#docs-site), [glossary.md](../../glossary.md)

## Context

The docs and the executable specs can only be read on GitHub, one file at a time. That
makes them hard to share with people outside the repo when a feature or a change is being
discussed:

- **Specs are written for the runner**<br>
  A `.feature` file is Gherkin source. Rules, Scenario Outlines and Examples tables read
  poorly as plain text, and the "Spec" links in the domain concepts open the raw files.
- **No way around the files**<br>
  There's no navigation across the docs, no search, and no view of which docs a spec
  belongs to.

The Markdown on GitHub has to keep working as it is: GitHub stays the main place the docs
are read and edited.

## Decision

Build a static website from `docs/` and `specs/` with **VitePress**, in its own pnpm
workspace package `site/`, and publish it with GitHub Pages from `main`.

- **The docs stay plain Markdown**<br>
  The site reads `docs/` as it is. No site-only syntax goes into `docs/`, so every doc
  still renders on GitHub unchanged.
- **A build step writes the site's content**<br>
  `site/scripts/generate.ts` copies the published docs and rewrites their links: a link
  to a published doc or spec goes to its page, a link to anything else goes to the file
  on GitHub. It turns each `.feature` file into a page with `@cucumber/gherkin`: rules as
  sections, each scenario's steps as a card, Examples and data tables as tables, and the
  Gherkin source in a fold-out.
- **A spec's docs come from the docs' own links**<br>
  The build turns the docs' links to `.feature` files around, so each spec page lists the
  docs whose rules it checks. **The build fails when a spec is linked from no doc**, so a
  new spec can't land without a doc rule pointing to it.
- **What's left out**<br>
  The runbook and the PR review catalogue: operations and review tooling, not the
  system's design. Links to them go to GitHub.
- **Look**<br>
  Nocturne's colours and the Inter font through VitePress's theme variables, dark by
  default. Nocturne is dark only, so the light theme is derived from its neutral and
  accent colour scales. `nocturne.css` stays untouched. Mermaid diagrams are drawn in the
  browser on a light card, because the diagrams in `docs/` set light fills for GitHub.
- **Checks**<br>
  CI's `docs-site` job builds the site on every pull request: the build step refuses an
  unlinked spec, and VitePress refuses a broken link. The build step's parts are unit
  tested in the `unit` Vitest project.
- **Nothing from `src/`**<br>
  The site imports no app code. Live app components in the docs were considered and not
  wanted.

## Rationale

- **VitePress over Docusaurus**<br>
  Docusaurus's main advantage is React components inside the docs (MDX), which this site
  doesn't want. VitePress reads the existing Markdown without changes, has built-in local
  search and Gherkin highlighting, refuses broken links, and is lighter. Its custom code
  is Vue, but that's one small component; the theme is CSS.
- **Back links from the docs over a mapping table**<br>
  Spec folder names match neither the domain nor the technical concept docs
  (`live-session` is specified in `live-collaboration.md` and built in
  `collaboration-mode.md`), and some specs belong to a technical doc only. The docs
  already link each spec from the rule it checks, so turning those links around needs no
  new configuration, and it can't drift.
- **A separate workspace package**<br>
  VitePress, Vue and Mermaid stay out of the app's `package.json`, and the site's build
  step has its own `tsconfig`.

## Consequences

- **Every spec needs a doc link**<br>
  A new `.feature` file fails CI until a doc links to it, usually from the rule it
  checks or from a technical concept's "Specs" table.
- **The repo is a pnpm workspace**<br>
  `pnpm-workspace.yaml` lists `site`, and `pnpm install` installs both packages.
  `knip.json` checks each workspace on its own.
- **GitHub Pages is a manual setting**<br>
  Pages has to be switched on in the repo settings, with GitHub Actions as its source.
  The runbook describes it.
- **No preview per pull request**<br>
  A proposed change is discussed in its pull request. The site shows what is on `main`.
- **A spec tagged `@fail` never appears**<br>
  CI refuses the tag (ADR-010), so it never reaches `main`. The spec page's "Not built
  yet" badge only shows in a local build.

## Alternatives considered (summary)

| Alternative | Why not |
|---|---|
| Docusaurus | React components in the docs aren't wanted; heavier, and MDX is stricter about the existing Markdown |
| MkDocs Material | Brings Python into a pnpm repo |
| Raw `.feature` files with highlighting only | Doesn't make the specs readable for people outside the team |
| A mapping table from spec folder to concept doc | Folder names match neither side's docs, and a folder-level mapping is too coarse |
| Changing the diagram colours in `docs/` for both themes | Changes how the 13 diagrams render on GitHub; the light card fixes it on the site alone |
| A preview build per pull request | Not needed now; GitHub Pages doesn't offer one |
