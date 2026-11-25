# Live Collaboration — Domain Concept

EstiMate has two session modes, **Live mode** and **Manual mode**. Both finalize each item
to the same `AggregateResult` (min, expected, ci90, max); only how the values get in
differs (see the rule **Both modes are interchangeable at the report**). Saving and loading
a session is its own concept, [session-persistence](session-persistence.md).
[PRD](../prd.md) §4.1 is the short product-facing summary of this process, §4.2 its
mode-comparison table.

## Process

### Live mode

The team estimates together in real time, each participant submitting their own numbers
from their own device.

Arrows lead to the next step; edge labels are the conditions.

```mermaid
flowchart TD
    Start["1 Start Live mode"] --> Join["2 Join"]
    Join --> Estimate["3 Estimate"]
    Join -->|no connection| Fallback["2a Connection fallback"]
    Fallback -->|retry| Join
    Estimate --> Reveal["4 Reveal"]
    Reveal --> Discuss{"5 Discuss:<br/>converged?"}
    Discuss -->|no, retry| Estimate
    Discuss -->|yes| Finalize["6 Finalize"]
    Finalize --> More{"More items?"}
    More -->|yes| Estimate
    More -->|no| Summary["7 Session summary"]
```

1. **Start Live mode** — the facilitator picks "Start collaborative" and immediately gets a
   shareable session code; the session name and items are added afterwards, and can keep changing
   mid-session
2. **Join** — a participant enters the code and their name (named, not anonymous — enables
   direct discussion)
   - **2a Connection fallback** — a participant who never reaches the facilitator (e.g. a
     strict network at join time) is told so plainly and offered a retry (see the rule
     **No mid-session mode switch**)
3. **Estimate** — for the active item, each participant privately submits Best Case, Most
   Likely and Worst Case in the session's unit
4. **Reveal** — the facilitator reveals the round, typically once everyone has submitted,
   but they may reveal as soon as anyone has. It shows each participant's three values side by side, plus the group's
   `AggregateResult`
5. **Discuss** — the team discusses outliers; the facilitator can retry the round, which
   clears its submissions
6. **Finalize** — the facilitator locks in the `AggregateResult` of the submissions and
   moves on to the next item; a finalized item can be reopened (see
   [Item lifecycle](#item-lifecycle))
7. **Session summary** — every finalized item with its min, expected and max; the session
   can be saved to a file

### Manual mode

The facilitator ran the estimation discussion elsewhere (in person, on a call, over Slack)
and types in the team's agreed numbers to get the same calculated ranges, guards and
report. No connection, no participants joining.

Arrows lead to the next step; edge labels are the conditions.

```mermaid
flowchart LR
    Start["1 Start Manual mode"] --> Enter["2 Enter values"]
    Enter --> Finalize["3 Finalize"]
    Finalize --> More{"More items?"}
    More -->|yes| Enter
    More -->|no| Summary["4 Session summary"]
```

1. **Start Manual mode** — the facilitator picks "Start single-user" and lands on the Workspace,
   where the session name and items are added
2. **Enter values** — the facilitator types the group's agreed Best Case, Most Likely and
   Worst Case for the item (a single set of values, no per-participant breakdown); the
   same bias guards fire as in Live mode (see [estimation-method](estimation-method.md))
3. **Finalize** — the values are locked in and the `AggregateResult` is calculated; a
   finalized item can be updated with new values later (see
   [Item lifecycle](#item-lifecycle))
4. **Session summary** — the same report as in Live mode

## Information model

```yaml
Session:
  sessionName: string            # can change mid-session
  unit: enum                     # hours | days | weeks, can change mid-session
  mode: enum                     # live | manual, fixed when the session starts
  items: Item[]                  # in list order

Item:
  id: string
  title: string                  # never blank
  description: string
  notes: string                  # captured during discussion
  finalResult: AggregateResult | null   # null until finalized
  round: number                  # Live mode: starts at 0, +1 on each retry or reopen
  revealed: boolean              # Live mode: this round's estimates are visible
  submissions: Estimate[]        # Live mode, facilitator only: one per participant this round

Estimate:
  participantId: string          # Manual mode: the facilitator
  best: number                   # best <= likely <= worst (see estimation-method)
  likely: number
  worst: number

Participant:                     # Live mode only; no account
  participantId: string          # stable per browser, so a reconnect is the same person
  name: string

RosterEntry:                     # values-free: who has submitted, never what
  participantId: string
  submitted: boolean
  connected: boolean
```

### Item lifecycle

An item is pending until it is finalized. In Live mode it goes through one or more
**rounds** on the way, each a pass of everyone estimating it; the `Round` state below
holds them. Arrows are transitions, labelled with the action that causes them.

```mermaid
stateDiagram-v2
    [*] --> Pending
    Pending --> Round: becomes active (Live)
    Pending --> Finalized: finalize (Manual)
    state Round {
        [*] --> Estimating
        Estimating --> Revealed: reveal
        Revealed --> Estimating: retry
    }
    Revealed --> Finalized: finalize
    Finalized --> Round: reopen (Live)
    Finalized --> Finalized: update (Manual)
```

Retrying and reopening both clear the item's submissions and start a new round; reopening
also clears its `finalResult`. In Manual mode, updating a finalized item replaces its
`finalResult` with newly entered values. In Live mode a finalized round takes no more
estimates, so only reopening it changes the result. Spec:
[`item-lifecycle.feature`](../../../specs/live-session/domain/item-lifecycle.feature).

## Rules

| Rule | Condition | Behavior | Spec |
|---|---|---|---|
| **Privacy before reveal** | Before the facilitator reveals the round | A participant never sees another's values: submissions go **only to the facilitator**, and everyone else sees a **values-free roster** | [`privacy-before-reveal.feature`](../../../specs/live-session/domain/privacy-before-reveal.feature) |
| **No mid-session mode switch** | The live connection fails | The **mode is fixed** when the session starts, for the session and for each item in it; the facilitator starts a fresh **Manual-mode session** instead of switching the running one | — |
| **A participant is in once they reach the facilitator** | A participant joins with a code and their name | They are still **joining** until they reach the facilitator, whichever teammates they reach first; someone who **never got in** is told apart from someone who **was in and lost the connection** | [`joining.feature`](../../../specs/live-session/domain/joining.feature) |
| **Late join and reconnect land on the correct view** | A participant joins mid-round, or reconnects | They see the **active item** and how many teammates have **submitted** (or, for an item finalized before the load, its saved result), whatever they missed while away; their own estimate survives a reconnect **only within the same round** | [`late-join-and-reconnect.feature`](../../../specs/live-session/domain/late-join-and-reconnect.feature), [`late-joiner.feature`](../../../specs/live-session/e2e/late-joiner.feature) (in the app) |
| **A submission counts once the facilitator has it** | A participant submits an estimate | It counts only once the facilitator's **roster shows it**; until then the participant sees it as **sending** or **not delivered**, and after a reconnect an estimate the facilitator lacks is **sent again** | [`submission-delivery.feature`](../../../specs/live-session/domain/submission-delivery.feature) |
| **Participants are shown by name** | Any view of the round's participants | A participant shows by the **name they announced**, otherwise as **"Teammate N"**; nobody's number changes when someone else announces later, and the facilitator's and participants' views label people alike | [`participant-names.feature`](../../../specs/live-session/domain/participant-names.feature) |
| **Every item has a title** | An item is added or renamed | A **blank title is refused**; the first item added becomes the active one, and removing the active item moves on to the first one still pending | [`item-list.feature`](../../../specs/live-session/domain/item-list.feature) |
| **Next and Previous follow the list** | The facilitator moves between items | **Next** goes to the item after the active one in list order, finalized or not, and from the last item to the **session summary**; **Previous** goes to the item before | [`navigation.feature`](../../../specs/live-session/domain/navigation.feature) |
| **Leaving asks first** | The facilitator leaves the Workspace while it would lose unsaved changes or teammates are still connected | Leaving **asks first** and names each loss: the unsaved changes, the session ending for the teammates, or both | [`leaving.feature`](../../../specs/live-session/domain/leaving.feature) |
| **Both modes are interchangeable at the report** | Always | The **session summary** and the **saved file** look the same whichever mode produced the values | — |
