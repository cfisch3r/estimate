# PRD: EstiMate — Live Three-Point Estimation for Dev Teams

**Status:** Draft v1
**Author:** [you]
**Based on:** Developer's Guide to Software Estimation (agiledojo.de, Episodes I–III)

## 1. Problem

Most planning poker tools (Fibonacci cards) collapse estimation into a single relative number. They don't communicate uncertainty, don't produce a defensible range for stakeholders, and don't guard against the psychological traps that make software estimates unreliable (false precision, symmetric ranges, underestimated worst cases).

EstiMate applies **three-point estimation** — the method recommended in Episode III for teams without historical data or facing high uncertainty — in a live, planning-poker-style session, and outputs the four values stakeholders actually need: **minimum, expected, 90% confidence interval, maximum**.

## 2. Goals

- Let a dev team estimate a backlog of items live, together, in real time — with no central server the app operator has to run
- Also support a solo facilitator who ran the discussion out-of-band (in person, on a call) and just wants to type in the team's agreed numbers
- For each item, produce a defensible range + confidence interval instead of a single guess
- Actively counter the known estimation biases from the source articles (symmetric ranges, underestimated worst case, false precision)
- Give facilitators a shareable summary/report at the end of a session
- Let teams come back to past sessions for reference

## 3. Non-goals (for MVP)

- Story point / velocity tracking (Method 1) — future phase
- T-shirt sizing + timeline bridge (Method 3) — future phase
- Jira/backlog tool import — future phase (manual entry only for MVP)
- Formal accounts/orgs beyond what's needed for session history (see §8)

## 4. Primary user & core flow

**Primary user:** dev teams doing estimation together (e.g., during backlog refinement or project kickoff), plus a facilitator running the session.

### 4.1 Session modes

At session creation, the facilitator picks one of two modes. Both modes produce the same output (items with min/expected/CI90/max) and share the same summary/report/history features — only how the numbers get in differs. See **ADR-001** for the reasoning behind offering both.

**Mode A — Live Collaborative Session (peer-to-peer)**
The team estimates together in real time, each participant submitting their own numbers from their own device, connected directly browser-to-browser (see §9, ADR-001).

1. **Create session** — facilitator names the session, adds items to estimate (title + optional description), picks "Live Collaborative," gets a shareable join link/code
2. **Join session** — participants open the link, enter their name (named, not anonymous — enables direct discussion), browser connects peer-to-peer into the session
3. **Estimate an item** — for the active item, each participant privately submits three numbers: **Best Case**, **Most Likely**, **Worst Case** (same unit, e.g., days)
4. **Reveal** — facilitator reveals once everyone has submitted (or manually). Shows each participant's three values side by side, plus the group's calculated confidence interval
5. **Discuss & converge** — team discusses outliers; facilitator can trigger a re-estimate round for the item
6. **Finalize item** — facilitator locks in the item's values (either the auto-calculated group range, or a manually reconciled one) and moves to the next item
7. **Session summary** — at the end, a report of all items with their four values, exportable and saved to session history
8. **Connection fallback** — if a participant's browser can't establish a direct peer connection (e.g., strict network), the app tells them plainly and suggests the facilitator either retry, have that person join via VPN, or switch that item to manual entry (Mode B) for the group

**Mode B — Single-User / Manual Entry Session**
The facilitator ran the estimation discussion elsewhere (in person, on a call, over Slack) and just wants to type in the team's agreed-upon numbers to get the same calculated ranges, guardrails, and report. No connection, no participants joining — just the facilitator and the app.

1. **Create session** — facilitator names the session, adds items, picks "Manual Entry"
2. **Enter values per item** — for each item, the facilitator types in the group's agreed Best Case / Most Likely / Worst Case directly (single set of values, no per-participant breakdown)
3. **Bias guards still apply** — symmetric-range warning, false-precision guard all fire the same way as in live mode (§6)
4. **Finalize item** — same as Mode A, values are locked and the app calculates min/expected/CI90/max
5. **Session summary** — same report format as Mode A, so history and exports are consistent regardless of mode used

### 4.2 Mode comparison

| | Mode A: Live Collaborative | Mode B: Manual Entry |
|---|---|---|
| Who submits | Each participant, from their own device | Facilitator only |
| Real-time sync needed | Yes (peer-to-peer) | No |
| Per-participant outlier view | Yes | No (single set of values) |
| Best for | Distributed team estimating together live | Facilitator recording a discussion that already happened |
| Network dependency | Requires peers to connect (see ADR-001) | None |

## 5. Key calculations (from the articles)

For each item, once best/worst/likely are set (individual or reconciled group values):

- **Minimum** = lowest Best Case submitted (or reconciled)
- **Most Likely (Expected)** = median or facilitator-reconciled value across "Most Likely" submissions
- **Maximum** = highest Worst Case submitted (or reconciled)
- **90% Confidence Interval** = `Most Likely + 1.28 × ((Worst Case − Best Case) / 3)` (McConnell's formula, Episode III)

Group aggregation logic (how individual submissions become one set of best/likely/worst) should be configurable but defaults to: **Best = min of all Best Cases, Worst = max of all Worst Cases, Likely = median of all Likely values** — i.e., don't average away the outliers, since the worst case in particular tends to get optimistically averaged down.

## 6. Bias-guarding features (differentiator)

These come directly from Tips #4–9 and are what make this more than a poker clone:

| Guard | Trigger | Behavior |
|---|---|---|
| **Symmetric range warning** | `(Likely − Best) ≈ (Worst − Likely)` within a tolerance | Gentle nudge: "Your range looks symmetric — worst case in software usually has more room than best case. Double check." |
| **False precision guard** | Non-round input in a context where rounding is expected (e.g., "3.7 days") | Soft suggestion to round to meaningful granularity |
| **Outlier flag at reveal** | A participant's value is far from the group median | Highlight (not hide) the outlier to prompt discussion, not silently average it out |
| **Uncertainty-range guard** | Facilitator has selected an uncertainty level for the item and entered best/worst | If the entered range is narrower than the guidance range for that level, nudge: "Your range looks narrow for [level] — teams at this stage typically see a wider spread. Double check." (see §6.1) |

These are nudges, not hard blocks — never prevent submission.

### 6.1 Cone-of-uncertainty guidance

Per item, the facilitator optionally selects an **uncertainty level** from 5 phases (based on the classic Cone of Uncertainty), each with its Agile-equivalent subtext:

| Level | Agile equivalent | Low mult. | High mult. | Range ratio |
|---|---|---|---|---|
| Initial Concept | Product Vision | 0.25x | 4x | 16x |
| Approved Product Definition | Backlog w/ Epics | 0.5x | 2x | 4x |
| Requirements Complete | Refined Stories | 0.67x | 1.5x | 2.25x |
| UI Complete | Sprint Planning I | 0.8x | 1.25x | 1.6x |
| Detailed Design Complete | Sprint Planning II | 0.9x | 1.10x | 1.2x |

Each level's multipliers are relative to Most Likely (e.g., at "Initial Concept," Best Case is expected to land around 0.25× Most Likely and Worst Case around 4× Most Likely). The **Range ratio** column is shown for readability (rounded to the source article's published values) but is not itself a stored threshold — implementations must derive the guidance ratio as `High mult. / Low mult.` from the two multiplier columns, since rounding makes a couple of the displayed Range ratio values (e.g. UI Complete's 1.6x vs. the exact 1.25/0.8 = 1.5625x) diverge slightly from that division.

When best/worst are both entered, compute the actual ratio = Worst / Best and compare it to the selected level's guidance ratio (`High mult. / Low mult.`, computed from the table above). If the actual ratio is smaller than the guidance ratio, the guard fires — the declared range is suspiciously narrow for how early/uncertain the item is.

- Level is optional and set **per item**, not per session — a backlog mixes items of different maturity.
- Soft nudge only — never blocks Finalize, consistent with every other §6 guard.

## 7. Screens (MVP)

1. **Landing / Create Session** — session name, add items (list, add/remove/edit), **choose mode (Live Collaborative / Manual Entry)**
2. **Join Session** *(Mode A only)* — enter name, join via code/link, connecting indicator while peer connection establishes
3. **Facilitator Session View** — item queue, current item spotlighted; in Mode A shows participant submission status (submitted/not) and reveal control, in Mode B shows direct input fields
4. **Participant Estimate View** *(Mode A only)* — current item detail, three number inputs (Best/Likely/Worst), submit
5. **Reveal View** *(Mode A only)* — table of participants × their three values, computed group range + confidence interval, outlier highlights, "re-estimate" and "finalize" actions
6. **Session Summary / Report** — all finalized items with four values, export (CSV/PDF/link), save to history — same layout regardless of mode
7. **Session History** — list of past sessions for a team, reopen a summary, shows which mode was used per session

## 8. Data model (sketch)

- **Team/Workspace** (lightweight — enough to group session history)
- **Session**: id, name, created_by, created_at, status (active/completed), team_id, **mode (live/manual)**
- **Item**: id, session_id, title, description, order, status (pending/estimating/finalized), final_min, final_expected, final_ci90, final_max
- **Estimate**: id, item_id, participant_name, best, likely, worst, submitted_at, round_number (supports re-estimate rounds). **In Mode B, a single Estimate row per item with participant_name = facilitator.**
- **Participant**: id, session_id, display_name (ephemeral — no account required to join). **Not used in Mode B.**

## 9. Non-functional requirements

- **Real-time sync** *(Mode A only)*: submissions and reveals sync live across participants via **peer-to-peer WebRTC connections, using public STUN servers for NAT traversal and serverless signaling** — no backend operated by the app for session communication (full reasoning in **ADR-001**)
- **No-account joining** *(Mode A)*: participants join with just a name; only the session creator/team needs persistent identity for history
- **Graceful degradation** *(Mode A)*: if a peer connection can't be established, the app surfaces this clearly rather than failing silently, and points the facilitator toward Mode B as a fallback for that session
- **Session persistence**: sessions and their reports are saved and retrievable later by the team, regardless of mode
- **Export**: session summary exportable as CSV and/or shareable read-only link

## 10. Success metrics

- % of sessions that reach a finalized range for every item (completion rate)
- Reduction in symmetric-range warnings triggered over time per team (learning signal)
- Sessions re-opened from history (validates the persistence feature is used)
- Qualitative: facilitator/team feedback that ranges feel more "honest" than prior poker-point estimates

## 11. Open questions

- How should re-estimate rounds be visualized in the final report — show convergence over rounds, or just the final round?
- Should facilitators be able to override/reconcile the auto-calculated group range manually before finalizing an item?
- Minimum viable auth: magic-link/email for session creators only, or fully open workspace links?
- Can a session be switched from Mode A to Mode B mid-session (e.g., after a connection fallback on one item), or is mode fixed at creation?
- Should Mode B support multiple named entries per item (e.g., facilitator typing in what each person said) rather than a single reconciled value — closer to Mode A's data shape without the live connection?

## 12. Future phases (post-MVP)

- **Phase 2**: Story Point + velocity tracking (Method 1) — teams with stable history skip live three-point sessions and use velocity-derived ranges instead
- **Phase 3**: T-shirt sizing for epics with bridge-to-three-point workflow (Method 3)
- **Phase 4**: Backlog tool import (Jira, Linear, etc.)
- **Phase 5**: Cone-of-uncertainty guidance — suggest expected range width based on declared project phase (see §6.1)

## 13. Related decisions

- **ADR-001: Peer-to-peer (STUN-assisted) architecture for live collaboration, with manual entry as a first-class fallback mode** — see accompanying ADR document
