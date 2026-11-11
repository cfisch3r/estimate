# Definition of Good — documentation

This file is the doc-review/doc-authoring plugin's own standard. It owns 100% of what
"good" means for a doc's *form* — it is never sourced from, or supplemented by, the
calling repo. The repo's own `AGENTS.md` and `docs/README.md` (or equivalent) are read for
exactly one thing: where a doc belongs (which file/folder a given piece of content goes
in). That's a file-location question, not a quality question, and it's answered by the
repo, never by this file.

Every reviewer agent and the `doc-authoring` skill read this file as their shared rubric —
literally, not distilled separately into each prompt. An agent's own prompt names the
section headings below relevant to its angle rather than restating their content.

## 1. Scannable form

- **Bold-headline prose list, not a bare bullet.** A list of several short, independent
  points (goals, NFRs, open questions, future phases) gets a **bold 2–4 word headline**
  per item, a `<br>` line break (not two trailing spaces — invisible in a diff), then the
  detail sentence indented below. A bullet of full sentences forces a reader to read every
  word to find the one that matters to them. The same bolding trick applies inside a dense
  table cell — bold the few nouns that matter, capped at roughly 20% of the cell, or
  nothing stands out anymore.
- **A diagram never replaces the prose it illustrates — it sits alongside it.** Removing
  the diagram should only cost an easier way to see something, never the information
  itself.
- **Match the diagram type to what's actually being shown:**
  - A **branching decision process** → a flowchart or state machine with real branches.
  - **Pure navigation/structure**, no decision logic → a state diagram (screens/states as
    nodes) plus a content table; no numbered prose steps needed.
  - **A linear, non-branching process with several named steps** still earns a small
    flowchart alongside its table — gate on "does seeing the step order help," not on
    "does it branch." Seeing order at a glance is worth it even with zero branches.
  - **A short, repeating state sequence belonging to one node** (e.g. one item's
    submitting → waiting → revealed states) → nest it as a composite state, rather than
    spelling it out in a table cell's prose.
- **UML stereotypes use real guillemets `«Screen»`, never the ASCII `<<Screen>>`
  substitute** — the ASCII double-angle-bracket form gets misread as an HTML tag by some
  Mermaid renderers, silently stripping the content between `<<` and `>>`.
- **Don't duplicate an edge's meaning in the table next to it.** If the diagram already
  shows "connection failed → back to mode selection," the table shouldn't restate it in
  prose — say it once, in whichever form is more precise for that fact.
- **Split a table column that's doing more than one job.** A single column mixing layout,
  mode-specific differences, and user actions becomes unreadable once any row has a lot
  going on. Split by *kind of fact*: a trait that repeats per row with few distinct values
  gets its own column.
- **Use badge/checkmark columns for small repeated categorical values**, instead of
  re-phrasing the same two or three states in prose each time.
- **An entity/field information model can be a commented YAML block instead of a table.**
  Each entity is a top-level key; each field is its own key with its type as the value
  (`best: number`), and inline/leading `#` comments carry validation constraints and notes
  (`likely: number   # ≥ best`). Reserve this for entities with per-field types/constraints
  worth stating — a flat enumeration of data rows with several numeric columns to compare
  side-by-side still reads better as a table.

## 2. Structural edits

- **Grep the whole repo for cross-references before and after a structural change**, not
  just inside the file being changed — other docs, source comments, and ADRs may all cite
  what's being renamed or moved.
- **Fix internal self-references inside the same doc too** (e.g. "see §7" inside the doc
  itself), not only external links.
- **Re-verify with a clean sweep after the edit**: a final grep for the old references,
  plus a listing of the doc's own headers, to confirm no gaps or stale mentions slipped
  through.
- **When content is extracted into its own doc, the source section becomes a short
  pointer, not a stub left to rot.** Don't leave two partially-overlapping copies of the
  same information in two docs.
- **Before merging, shortening, or removing a section with real content, inventory it
  clause by clause — don't just paraphrase.** A "make this shorter" or "merge X into Y"
  instruction executed as a straight rewrite has no built-in check that every distinct
  requirement in the old text landed somewhere; cross-reference grepping only catches
  broken *links*, not silently dropped *content*. For each distinct clause in the old
  text, classify it:
  - **Kept verbatim** — no finding.
  - **Paraphrased into doc Z** — no finding, *unless* the paraphrase measurably narrows or
    drops part of the original claim (not just its wording).
  - **Explicitly dropped, because —** a finding, with a reason. A drop needs a reason
    instead of just not surviving a rewrite.

  **This doesn't fully automate.** Telling a dropped line that's a real requirement apart
  from one that's just redundant phrasing needs judgment — a reviewer or author applying
  this section should flag an uncertain drop rather than stay silent about it. A false
  positive here costs a quick dismissal; a false negative silently repeats the exact
  failure this check exists to catch.

## 3. Terminology and fidelity to source

- **One concept, one name, used everywhere it appears.** Don't introduce a synonym for an
  existing term even if it reads well locally — prefer whatever name the rest of the doc
  set already uses, so a reader never has to learn that two phrases mean the same thing.
- **New or changed vocabulary belongs in the project's shared glossary**, not just used ad
  hoc in one doc.
- **A doc's field/type names must match the actual source identifiers, not an
  independently-invented label.** Read the real type/const in the source code before
  writing or rewriting a field list — don't carry forward a prior doc's naming on trust,
  and don't guess a plausible-sounding name.

## 4. Diagram conventions (Mermaid)

- **Component-style diagrams**: use C4-style box labels — `Name` on line 1, a bracketed
  type or `[Conceptual role: Technical type]` on line 2 — but draw them as a Mermaid
  **`flowchart`**, never Mermaid's native `C4Component` type (its auto-layout and arrow
  routing are too messy for this).
- **No emoji in a diagram** — includes lane/subgraph titles. Lane distinction comes from
  background tint + `classDef` coloring alone, plus an UPPERCASE title.
- **Spell out multiplicity, don't abbreviate it.** Prefer "5 parallel Jobs" (with the
  actual item names in the node title lines) over an abbreviated "5x Job".
- **Separate structure from behavior when a system has multiple distinct
  triggers/flows.** Don't cram trigger-specific semantics into one static dependency
  diagram. Draw one structural diagram (components + dependencies, no trigger nodes), plus
  one additional flow diagram per distinct trigger/entry point, showing only that path.
- **Depicting order/sequencing within a `flowchart`** (rather than reaching for
  `sequenceDiagram`): number the edges (`-->|1|`, `-->|2|`, ...) to show call order, and
  render a short-circuited/skipped branch as a dashed, distinctly-styled node
  (`classDef skipped fill:transparent,stroke-dasharray: 2 2,color:gray`) rather than
  omitting it.
- **Responsibilities table:** each component's responsibilities go in a table *below* the
  diagram, never inside the boxes. Drop a column that's now redundant with a diagram the
  reader can already see (e.g. a "Trigger" column once trigger-specific flow diagrams
  exist separately).
- **Lanes must be visually distinct:** group nodes into subgraph "lanes" (usually by
  source directory, or by concern). Each lane gets an UPPERCASE title, a light background
  tint, and member nodes colored to match via `classDef`/`class`. Use `direction LR`
  inside multi-node lanes. Keep external systems outside all lanes (dashed border,
  `classDef external`).
- **Line legend above every diagram:** solid = synchronous call, dotted = async
  callback/event/read, `<-->` = bidirectional. Label edges with what crosses them.
- **Reduce arrow clutter:** collapse many parallel edges (e.g. store → each screen) into
  one edge pointing at the lane/subgraph.

## 5. Doc hygiene

- **No issue/ticket numbers inside doc bodies.** Docs should stand alone over time; issues
  get closed, renumbered, or lose meaning, so don't couple a living doc's content to the
  tracker.
- **Treat operational specifics as sensitive by default, even in internal docs.**
  Production URLs, hosting IDs, and similar specifics default to omitted unless the
  project's own author confirms they belong in the doc.
- **Consolidate overlapping sections instead of letting them fragment.** When a new fact
  overlaps an existing section, fold it in rather than giving it a separate nearby home.
- **Be precise about routine vs. edge-case wording.** Don't phrase a now-resolved one-time
  issue so it reads as expected recurring behavior — flag it as only resurfacing under a
  specific future condition, if that's what's true.
- **A new doc must be wired into every existing index/cross-reference, not just
  created.** Update the doc-index table, any top-level doc list, and any other doc with a
  now-stale related mention.
- **Iterative pruning, not one-shot approval.** Expect — and, when authoring, invite —
  several rounds of "cut this" / "reword that" on a drafted section, rather than a single
  approve/reject of the whole draft.

## 6. Rendering on GitHub

- **Set explicit text colors** on Mermaid nodes and lane titles — a diagram with only
  fills can be unreadable in GitHub's dark mode.
- **Keep every edge label short, or split it with `<br/>`** — GitHub's renderer clips
  longer labels.
- **Don't rely on an edge between two adjacent lanes being visible** — the layout engine
  typically places adjacent lanes only a few pixels apart, so such an edge can be
  invisible. Prefer a separate lane-relationship diagram instead.
- **Never put a semicolon in a Mermaid sequence-diagram message or note** — Mermaid ends
  the statement there and the rest fails to parse. Use a comma instead.
- **Local render is a check, not proof.** Local preview and GitHub's renderer are
  different Mermaid builds; a diagram isn't verified until it's been checked on GitHub
  itself, in both light and dark mode. Say plainly when only a local render has been
  checked.

## 7. Proven doc elements

A concrete catalogue, so a review or a draft checks *against* this table, not only against
the prose rules above it — a prose wall where one of these forms clearly fits is itself a
finding, not only a convention violation.

| Proven element | Use it for | Generic example |
|---|---|---|
| Bold-headline prose list (`**Headline**<br>detail`) | Several short, independent points (goals, NFRs, open questions) | `**Ships Friday**<br>No new scope added after Wednesday.` |
| Split table (one column per kind of fact) | Items compared across several distinct attributes | See the table immediately below. |
| Commented YAML info model | An entity with per-field types/constraints worth stating | See the YAML block immediately below. |
| Diagram matched to shape (flowchart for branching, state diagram for pure navigation, nested composite state for a short repeating sequence) | A branching process, navigation, or a repeating state sequence | A login flow (branching → flowchart) or a wizard's steps (pure navigation → state diagram) |

Split-table example (one column per kind of fact, not one column mixing several):

| Feature | Status | Owner |
|---|---|---|
| Dark mode | In progress | Priya |
| Export | Done | Sam |

Commented YAML info model example:

```yaml
Order:
  id: string
  total: number    # >= 0
  status: enum      # draft | placed | shipped
```

No column or line in this table points at which real file in the *calling* repo exercises
a pattern well — that's a repo-specific pointer, and it belongs only in that repo's own
`AGENTS.md` (or equivalent), never in this plugin's rubric.

## 8. How agents use this file

This file is shared literally across the Consistency, Quality, and Completeness reviewer
agents and the `doc-authoring` skill — none of them should restate its content in their
own prompt. Each one's prompt instead names the specific section headings above relevant
to its own angle.
