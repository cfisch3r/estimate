# Live Collaboration — Domain Concept

EstiMate has two session modes. Both produce the same four values per item (minimum,
expected, 90% confidence interval, maximum) and share the same summary, export, and
save/load behavior — only how the numbers get in differs (**ADR-001** records why both
modes exist). [PRD](../prd.md) §4.1 is the short product-facing summary of this process,
§4.2 its mode-comparison table.

## Process

**Live mode — live collaborative session (peer-to-peer)**
The team estimates together in real time, each participant submitting their own numbers
from their own device.

1. **Start collaborative** — the facilitator starts a session and immediately gets a
   shareable code; the session name and items are added afterwards, and can keep changing
   mid-session
2. **Join session** — a participant opens the link and enters their name (named, not
   anonymous — enables direct discussion)
3. **Estimate an item** — for the active item, each participant privately submits three
   numbers: Best Case, Most Likely, Worst Case (same unit, e.g. days)
4. **Reveal** — the facilitator reveals once everyone has submitted, or manually. Shows
   each participant's three values side by side, plus the group's calculated confidence
   interval
5. **Discuss & converge** — the team discusses outliers; the facilitator can trigger a
   re-estimate round for the item
6. **Finalize item** — the facilitator locks in the item's values (either the
   auto-calculated group range, or a manually reconciled one) and moves to the next item
7. **Session summary** — at the end, a report of all items with their four values,
   exportable and saveable to a file for later reference
8. **Connection fallback** — if a participant never reaches the facilitator (e.g. a strict
   network at join time), the app tells them plainly and offers a retry; there is no
   in-app way to switch a single item, or the running session, to Manual mode mid-flight
   (**ADR-003**, "Role-asymmetric link state")

**Manual mode — single-user entry session**
The facilitator ran the estimation discussion elsewhere (in person, on a call, over Slack)
and just wants to type in the team's agreed-upon numbers to get the same calculated ranges,
guardrails, and report. No connection, no participants joining.

1. **Start single-user** — the facilitator starts a session and lands on the workspace,
   where the session name and items are added
2. **Enter values per item** — the facilitator types in the group's agreed Best Case / Most
   Likely / Worst Case directly (a single set of values, no per-participant breakdown)
3. **Bias guards still apply** — the same guards fire as in Live mode (see
   [estimation-method](estimation-method.md))
4. **Finalize item** — same as Live mode: values are locked and the app calculates
   min/expected/CI90/max
5. **Session summary** — the same report format as Live mode

## Information model

| Entity / value object | Fields | Notes |
|---|---|---|
| **Session** | name, estimation unit, mode (live/manual) | Created by the facilitator; name and unit can change mid-session |
| **Item** | title, description, order, status (pending/estimating/finalized), finalResult | One backlog item being estimated |
| **Participant** | id, display name | Ephemeral — no account. Not used in Manual mode, where there is only the facilitator |
| **Estimate** | participantId, best, likely, worst, round number | Self-validating: `best ≤ likely ≤ worst` (see [estimation-method](estimation-method.md)). In Manual mode, a single Estimate per item, authored by the facilitator |
| **Roster** | participantId → submitted / connected | Values-free — tells who has submitted, never what |

A **round** is the lifecycle of one Item through estimate → reveal → (retry →) finalize.
Retrying an item clears its submissions and starts the round again; finalizing freezes its
`finalResult` and moves the facilitator on to the next item.

`Team`/`Workspace` (a lightweight grouping for session history, PRD §3) is not included
above — it has no process, rule, or implemented behavior of its own yet, only a mention as
a future grouping concept. It belongs here once a process or rule for it exists.

## Rules

| Rule | Condition | Behavior |
|---|---|---|
| **Privacy before reveal** | Before the facilitator reveals the round | A participant never sees another's values — targeted submission, a values-free roster in the meantime |
| **No mid-session mode switch** | Live connection fails | The facilitator starts a fresh Manual-mode session rather than switching the running one |
| **Late join and reconnect land on the correct view** | A participant joins mid-round, or reconnects | They see the item currently active and how many teammates have submitted, regardless of what they missed while away. Pinned down as an executable acceptance criterion in [`specs/live-session/e2e/late-joiner.feature`](../../../specs/live-session/e2e/late-joiner.feature) |
| **Both modes are interchangeable at the report** | Always | Saving, exporting, and the session summary look the same regardless of which mode produced the values |
| **A session survives only as a saved file** | The session holds changes that no saved or loaded file has | Leaving it, or closing the tab, asks for confirmation first; right after a save or a load, nothing asks. Pinned down in [`specs/session-persistence/e2e/unsaved-changes.feature`](../../../specs/session-persistence/e2e/unsaved-changes.feature) |
| **A saved file holds no running round** | Saving in either mode | The file keeps the session name, unit and every item with its final result, never a round's submissions: they belong to participants of a session that won't exist when the file is loaded. Pinned down in [`specs/session-persistence/domain/read-session-file.feature`](../../../specs/session-persistence/domain/read-session-file.feature) |
| **Load only before a mode starts** | A facilitator resumes a saved session | Loading happens on mode selection; the loaded session then starts in either mode, resuming at the first item still needing an estimate. A running live session is never replaced, since participants would silently fall out of sync. A file that breaks a rule is rejected whole, with the reason. Pinned down in [`specs/session-persistence/e2e/save-and-resume.feature`](../../../specs/session-persistence/e2e/save-and-resume.feature) |
| **A saved file is named after its session and day** | Saving | The file name is the session name as a filename-safe slug, then the local save date, then `.estimate.json`. Pinned down in [`specs/session-persistence/domain/save-file-name.feature`](../../../specs/session-persistence/domain/save-file-name.feature) |
