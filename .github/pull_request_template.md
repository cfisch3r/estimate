<!--
Fill in every section and write like one person to another. The title must be a Conventional Commit (`feat: ...`, `fix: ...`,
`docs: ...`): it becomes the squash commit and drives release-please. No AI attribution lines.
`gh pr create` skips this file: pass the filled text with --body-file.
-->

<!-- Closes #n for issue-sized work. Omit this line otherwise; never leave a placeholder or guess an issue number. -->

## Why the change

<!-- Exactly one sentence: the problem this PR solves and what becomes possible after it ships. -->

## Special things to note

<!-- 1-3 bullets: reviewer-relevant warnings, migrations, constraints, deliberate omissions, surprising decisions. Use "None." when there are none. -->

-

## Change outline

<!--
A compact structural view, not prose or a file-by-file changelog. Use only the views that help,
named and ordered by the change: key type changes, pseudocode for changed behaviour, a shallow
file tree, a component tree, call or data flow. Prefer `diff` blocks for changes to existing
shapes; show the complete shape when most of it is new. Keep only the types, calls and files
the reviewer needs. Mermaid must render on GitHub: explicit text colours, short edge labels.

A file-layout change:

```diff
 src/
 ├── commands/
+│   └── expand.ts        # expands the slash command
 ├── sessions/
-└── transport.ts
+└── transport/
+    ├── client.ts
+    └── stream.ts
```

A call-tree change:

```diff
 submitForm
   createSession
     persistPrompt
+    expandSkillMention
     launchAgent
   navigateToSession
+    subscribeToEvents
```

A component change:

```diff
 <SessionPage>
   useSessionEvents()
   <SessionToolbar>
+    <RunSkillButton />
```
-->
