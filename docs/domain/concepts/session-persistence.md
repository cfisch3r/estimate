# Session Persistence — Domain Concept

A session lives only in the open browser tab. Saving it to a file is the only way it
outlives that tab: there are no accounts and no server-side storage ([PRD](../prd.md) §6,
"Session persistence"). Both modes save and load the same way ([live-collaboration](live-collaboration.md)
covers the modes themselves). Only the role that holds the item list — the single user, or
the facilitator of a live session — has a session to save; a participant never does.

## Process

**Save and resume**

1. **Save** — at any point in either mode, the facilitator saves the session; the browser
   downloads it as a file
2. **Leave** — leaving the session, or closing the tab, is safe once it is saved; with
   unsaved changes, both ask for confirmation first
3. **Load** — later, on mode selection, the facilitator picks the saved file; it is checked
   whole, and either restored or rejected with the reason
4. **Continue** — the facilitator starts either mode with the loaded session, which resumes
   at the first item still needing an estimate

## Information model

```yaml
SessionFile:             # what a saved file holds (format version 1)
  version: number        # 1; a newer version is rejected, not guessed at
  sessionName: string    # may be empty
  unit: enum             # hours | days | weeks
  items: Item[]          # every item, finalized or not, in order

Item:                    # as saved — no running round
  id: string             # unique within the file
  title: string          # not blank
  description: string
  notes: string
  finalResult: AggregateResult | null   # keeps every final-result rule; null = not estimated
```

`AggregateResult` is the four values of [estimation-method](estimation-method.md), checked by its rules there. A
running round's submissions, its reveal state and its round number are never part of the
file: they belong to participants of a session that won't exist when the file is loaded.

## Rules

| Rule | Condition | Behavior | Spec |
|---|---|---|---|
| **A session survives only as a saved file** | The session holds changes that no saved or loaded file has | Leaving it, or closing the tab, asks for confirmation first. Right after a save or a load, nothing asks | [unsaved-changes](../../../specs/session-persistence/e2e/unsaved-changes.feature) |
| **Only the item-list holder can lose a session** | A participant in a live session | Never asked to confirm leaving for unsaved changes, and offered no Save | — |
| **A saved file holds no running round** | Saving in either mode | The file keeps name, unit and every item with its final result, nothing of a round in progress | [read-session-file](../../../specs/session-persistence/domain/read-session-file.feature) |
| **Load only before a mode starts** | A facilitator resumes a saved session | Loading happens on mode selection; the loaded session then starts in either mode | [save-and-resume](../../../specs/session-persistence/e2e/save-and-resume.feature) |
| **A running live session is never replaced** | A live session is in progress | No load is offered: replacing the item list under connected participants would silently put them out of sync | — |
| **A resumed session starts at the open work** | A loaded session starts | The first item still needing an estimate is active | [save-and-resume](../../../specs/session-persistence/e2e/save-and-resume.feature) |
| **A file is restored whole or not at all** | A file breaks a rule of the information model | Nothing is loaded, and the user is told which rule, by item number and title | [read-session-file](../../../specs/session-persistence/domain/read-session-file.feature) |
| **A saved file is named after its session and day** | Saving | The session name as a filename-safe slug, then the local save date, then `.estimate.json`; a session without a usable name becomes `estimate-session` | [save-file-name](../../../specs/session-persistence/domain/save-file-name.feature) |
