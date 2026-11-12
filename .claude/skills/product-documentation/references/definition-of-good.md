# Definition of Good — documentation

This file is the `product-documentation` plugin's own standard for a doc's *form* —
never sourced from, or supplemented by, the calling repo. The repo's `AGENTS.md`/
`docs/README.md` are read only for where a doc belongs; that's a location question, not a
quality one.

Every reviewer agent and the `authoring` skill read this file literally as their shared
rubric, rather than restating it — each prompt just names the section relevant to its
angle.

## 1. Scannable form

- **Bold-headline prose list, not a bare bullet.** Several short, independent points
  (goals, NFRs, open questions) get a **bold 2–4 word headline** + `<br>` (not two
  trailing spaces — invisible in a diff) + the detail indented below, so a reader scans
  for the headline that matters to them. Same trick in a dense table cell — bold the few
  nouns that matter, capped at ~20% of the cell.
- **A diagram replaces relationship prose.** Component/architecture diagrams, state
  transitions: don't also narrate those relationships in prose — the diagram already
  shows them. Details (responsibilities, fields, constraints) go in a table below the
  diagram instead, never duplicated in both.
- **One exception: a process diagram accompanies its steps.** It only shows *order*; the
  substance of each step lives in the prose, which the diagram can't carry. Removing the
  diagram costs the at-a-glance order, not the steps' own information.
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
- **UML stereotypes use real guillemets `«Screen»`, never ASCII `<<Screen>>`** — some
  Mermaid renderers misread the ASCII form as an HTML tag and strip it.
- **Don't duplicate an edge's meaning in the table next to it.** Say a fact once, in
  whichever form is more precise.
- **Split a table column doing more than one job** — one column per *kind of fact*,
  rather than mixing layout, differences, and actions into one unreadable column.
- **Badge/checkmark columns for small repeated categorical values**, instead of
  re-phrasing the same two or three states in prose each time.
- **A commented YAML info model instead of a table**, when an entity has per-field
  types/constraints worth stating (`field: type   # constraint`) — a flat numeric
  enumeration still reads better as a table.

## 2. Structural edits

- **Grep the whole repo for cross-references before and after a structural change** —
  other docs, source comments, and ADRs may cite what's being renamed or moved.
- **Fix internal self-references too** (e.g. "see §7" inside the same doc), not just
  external links.
- **Re-verify with a clean sweep after the edit**: a final grep for old references, plus
  the doc's own header list, to confirm nothing stale slipped through.
- **Extracted content's source section becomes a short pointer, not a rotting stub** —
  don't leave two overlapping copies of the same information.
- **Before merging, shortening, or removing a section with real content, inventory it
  clause by clause — don't just paraphrase.** Cross-reference grepping only catches
  broken *links*, not silently dropped *content*. Classify each distinct old clause:
  - **Kept verbatim** — no finding.
  - **Paraphrased into doc Z** — no finding, *unless* the paraphrase narrows or drops part
    of the original claim.
  - **Explicitly dropped, because —** a finding; a drop needs a reason, not just a rewrite
    it didn't survive.

  This doesn't fully automate — a real requirement vs. redundant phrasing needs judgment.
  Flag an uncertain drop rather than stay silent: a false positive costs a quick
  dismissal, a false negative repeats the exact failure this check exists to catch.

## 3. Terminology and fidelity to source

- **One concept, one name, everywhere.** No local synonym for an existing term, even if
  it reads well — a reader shouldn't have to learn two phrases mean the same thing.
- **New or changed vocabulary belongs in the project's shared glossary**, not ad hoc in
  one doc.
- **A doc's field/type names must match the actual source identifiers.** Check the real
  type/const before writing — don't carry forward a prior doc's naming on trust, or guess.

## 4. Diagram conventions (Mermaid)

- **Component-style diagrams**: C4-style box labels (`Name` / `[type]` or `[Conceptual
  role: Technical type]`) drawn as a Mermaid **`flowchart`**, never native `C4Component`
  (its auto-layout is too messy here).
- **No emoji in a diagram**, including lane titles — lane distinction comes from tint +
  `classDef` coloring plus an UPPERCASE title.
- **Spell out multiplicity** ("5 parallel Jobs" with real item names), don't abbreviate
  ("5x Job").
- **Separate structure from behavior**: one structural diagram (components + deps, no
  triggers) plus one flow diagram per distinct trigger/entry point, not cramming both
  into one.
- **Order/sequencing in a `flowchart`** (not `sequenceDiagram`): numbered edges
  (`-->|1|`, `-->|2|`), a short-circuited branch as a dashed
  `classDef skipped fill:transparent,stroke-dasharray:2 2,color:gray` node, not omitted.
- **Responsibilities table below the diagram**, never inside the boxes; drop a column
  now redundant with a diagram the reader can already see.
- **Lanes must be visually distinct**: subgraphs by source directory/concern, UPPERCASE
  title, light tint, matching `classDef`/`class` node coloring, `direction LR` inside
  multi-node lanes; external systems outside all lanes, dashed border.
- **Line legend above every diagram**: solid = sync, dotted = async/event/read, `<-->` =
  bidirectional; label edges with what crosses them.
- **Reduce arrow clutter**: collapse many parallel edges (e.g. store → each screen) into
  one edge at the lane.

## 5. Doc hygiene

- **No issue/ticket numbers inside doc bodies** — docs should stand alone; trackers get
  closed or renumbered.
- **Operational specifics are sensitive by default**, even in internal docs — omit prod
  URLs/hosting IDs unless the author confirms they belong.
- **Consolidate overlapping sections** instead of letting a new fact fragment into a
  separate nearby home.
- **Don't introduce a new form/format where an existing one already serves** — check §7's
  catalogue and this doc set's existing patterns before inventing a bespoke structure for
  something a proven element already covers.
- **Precise routine vs. edge-case wording** — don't phrase a resolved one-time issue as
  expected recurring behavior.
- **A new doc wired into every existing index/cross-reference, not just created.**
- **Iterative pruning, not one-shot approval** — expect several rounds of "cut this" /
  "reword that," not a single approve/reject of the whole draft.

## 6. Rendering on GitHub

- **Explicit text colors** on Mermaid nodes/lane titles — fills alone can be unreadable
  in GitHub's dark mode.
- **Short edge labels, or split with `<br/>`** — GitHub's renderer clips longer ones.
- **Don't rely on a visible edge between adjacent lanes** — the layout engine puts them
  too close; use a separate lane-relationship diagram instead.
- **Never a semicolon in a Mermaid sequence-diagram message/note** — the parser ends the
  statement there; use a comma.
- **Local render is a check, not proof** — different Mermaid build than GitHub's; say
  plainly when only the local render has been checked.

## 7. Proven doc elements

A concrete catalogue to check *against*, not just the prose rules above — a prose wall
matching one of these rows is itself a finding, not only a convention violation.

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

No line here points at which real file in the *calling* repo exercises a pattern well —
that's repo-specific, and belongs only in that repo's own `AGENTS.md`, never here.

## 8. How agents use this file

Shared literally across the Consistency, Quality, and Completeness reviewers and
`authoring` — none restate its content; each prompt just names the relevant section.
