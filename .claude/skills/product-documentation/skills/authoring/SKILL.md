---
name: authoring
description: Applies the product-documentation plugin's Definition of Good while creating or substantially restructuring a file under docs/, README.md, or AGENTS.md — scannable form, right diagram type, table structure, terminology, proven-element choice. For a structural edit to existing content (merge, shorten, or remove a section), runs a clause inventory before the edit and waits for a go-ahead. Use before writing or substantially editing a doc file.
user-invocable: false
---

# Writing docs well

1. Read `.claude/skills/product-documentation/references/definition-of-good.md` in full —
   the same file the three review agents use, not a copy. It's the plugin's own standard;
   apply it as given, don't restate it here.

2. **Drafting new content**: pick the form the content's shape calls for *before*
   defaulting to prose — the rubric's §1 (scannable form), §4 (diagram conventions), §6
   (GitHub rendering), and §7 (the proven-doc-elements catalogue) tell you which form fits
   which shape. Apply §3 (terminology and fidelity) when naming entities or fields — check
   the real source identifier, don't invent a plausible-sounding one. Once the doc is
   placed, apply §5's "wire into every index" step — update the doc-index table and any
   other doc with a now-stale related mention.

3. **A structural edit to existing content** (merging, shortening, or removing a section
   that has real content) is a different, higher-stakes case. Before applying the edit,
   run the rubric's §2 clause-inventory mechanism yourself: for every distinct clause in
   the section being touched, classify it as kept verbatim / paraphrased into doc Z /
   explicitly dropped-because. Show that inventory to the user and **wait for an explicit
   go-ahead before applying the edit** — don't treat "sounds good" about the plan as also
   meaning "go ahead and make the edit." This is the same ask-don't-assume pattern this
   repo already uses for specs (`docs/technical/adr/010-spec-first-gherkin-specs.md`'s
   propose-then-wait workflow steps), applied here to doc edits rather than specs.

4. **Where does this content belong?** Read the repo's own `AGENTS.md` and
   `docs/README.md` for that — which file/folder a given piece of content goes in (e.g.
   domain vs. technical, PRD vs. concept doc vs. ADR) is a file-location question the repo
   answers, never a quality question the rubric answers.
