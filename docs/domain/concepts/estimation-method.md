# Estimation Method — Domain Concept

Three-point estimation: for each item, best/most likely/worst case become a defensible
range and a 90% confidence interval, and a set of bias guards actively counters the known
estimation traps (symmetric ranges, underestimated worst case, false precision). Source:
Developer's Guide to Software Estimation (agiledojo.de, Episodes I–III). See
[PRD](../prd.md) §5/§6/§6.1 for the short product-facing summary.

## Process

For each item, once best/likely/worst are set (individual submissions, or a
facilitator-reconciled value):

1. **Aggregate** — individual submissions become one group range: **Best** = minimum of all
   Best Cases, **Worst** = maximum of all Worst Cases, **Likely** = median of all Likely
   values. Don't average away the outliers — the worst case in particular tends to get
   optimistically averaged down. (A single-entry group, as in Manual mode, degenerates to
   that one estimate's own values.)
2. **Compute the confidence interval** — 90% Confidence Interval =
   `Likely + 1.28 × ((Worst − Best) / 3)` (McConnell's formula, Episode III)
3. **Guard** — as values are entered, and again at reveal, the bias guards below run and
   surface nudges; none of them block submission or finalize
4. **Finalize** — the four values (min, expected, CI90, max) are locked for the item

## Information model

| Entity / value object | Fields | Notes |
|---|---|---|
| **Estimate** | best, likely, worst | Self-validating: only constructible with `best ≤ likely ≤ worst` — illegal ranges can't be represented |
| **AggregateResult** | min, expected, ci90, max | The group range produced by the Process above |
| **Uncertainty level** | name, Agile equivalent, low/high multiplier | One of 5 phases of the classic Cone of Uncertainty (see below); selected per item, per participant |

### Cone-of-uncertainty guidance levels

Each participant selects an uncertainty level from 5 phases, always preselected
("Requirements Complete," the middle phase) so guidance is visible as soon as best/worst
are entered. The level is local to that participant's own view, not shared or synced, and
can be changed at any time — a backlog mixes items of different maturity, and different
participants may reasonably assess the same item's maturity differently.

| Level | Agile equivalent | Low mult. | High mult. |
|---|---|---|---|
| Initial Concept | Product Vision | 0.25x | 4x |
| Approved Product Definition | Backlog w/ Epics | 0.5x | 2x |
| Requirements Complete | Refined Stories | 0.67x | 1.5x |
| UI Complete | Sprint Planning I | 0.8x | 1.25x |
| Detailed Design Complete | Sprint Planning II | 0.9x | 1.10x |

The multipliers are anchored to Best Case, not Most Likely — e.g. at "Initial Concept,"
Worst Case is expected to land around 4× (High mult. / Low mult. = 16x) the Best Case, not
4× Most Likely. The guidance ratio is always `High mult. / Low mult.`, computed from the
table at implementation time rather than stored as its own rounded column, since a rounded
display value can drift out of sync with the exact division.

## Rules (bias guards)

These are nudges, not hard blocks — they never prevent submission or finalize.

| Guard | Trigger | Behavior |
|---|---|---|
| **Symmetric range warning** | `(Likely − Best) ≈ (Worst − Likely)` within a tolerance | Nudge: the range looks symmetric, worst case in software usually has more room than best case |
| **False precision guard** | Non-round input where rounding is expected (e.g. "3.7 days") | Soft suggestion to round to the unit's expected granularity |
| **Outlier flag at reveal** | A participant's value is far from the group median | Highlight (not hide) the outlier, to prompt discussion rather than silently average it out |
| **Uncertainty-range guard** | The entered range (worst/best ratio) is narrower than the selected uncertainty level's guidance ratio | Nudge: the range looks narrow for that phase, teams at this stage typically see a wider spread. If the ratio already meets or exceeds guidance, show a calm confirmation instead |

No executable spec exists yet for this concept's behavior (only the live-session join flow
is covered so far — see [live-collaboration](live-collaboration.md)).
