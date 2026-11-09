# PRD: EstiMate — Live Three-Point Estimation for Dev Teams

**Status:** Draft v1
**Author:** Christian Fischer
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
- Let a session be saved and reopened later, so teams can come back to it for reference

## 3. Non-goals (for MVP)

- Story point / velocity tracking (Method 1) — future phase
- T-shirt sizing + timeline bridge (Method 3) — future phase
- Jira/backlog tool import — future phase (manual entry only for MVP)
- Formal accounts/orgs beyond what's needed for session persistence (see §8)

## 4. Primary user & core flow

**Primary user:** dev teams doing estimation together (e.g., during backlog refinement or project kickoff), plus a facilitator running the session.

### 4.1 Session modes

On the entry screen, before any session setup, the facilitator picks one of two modes. Both modes produce the same output (items with min/expected/CI90/max) and share the same summary/report/save-and-load features — only how the numbers get in differs. See **ADR-001** for the reasoning behind offering both, and
[live-collaboration](concepts/live-collaboration.md) for the full process, information
model, and rules of both modes.

### 4.2 Mode comparison

| | Live mode (Mode A) | Manual mode (Mode B) |
|---|---|---|
| Who submits | Each participant, from their own device | Facilitator only |
| Real-time sync needed | Yes (peer-to-peer) | No |
| Per-participant outlier view | Yes | No (single set of values) |
| Best for | Distributed team estimating together live | Facilitator recording a discussion that already happened |
| Network dependency | Requires peers to connect (see ADR-001) | None |

## 5. Key calculations (from the articles)

Three-point estimation turns best/likely/worst submissions into a defensible range and a
90% confidence interval (McConnell's formula, Episode III). Full process and information
model: [estimation-method](concepts/estimation-method.md).

## 6. Bias-guarding features (differentiator)

The symmetric-range warning, false-precision guard, outlier flag, and uncertainty-range
guard come directly from Tips #4–9 and are what make this more than a poker clone — nudges,
never hard blocks. Full guard table: [estimation-method](concepts/estimation-method.md).

### 6.1 Cone-of-uncertainty guidance

Per item, each participant selects an uncertainty level from 5 phases of the classic Cone
of Uncertainty, local to their own view. Full levels table and guard mechanics:
[estimation-method](concepts/estimation-method.md).

## 7. Screens (MVP)

1. **Mode selection** — entry screen: start single-user, start collaborative (generates a session code), or join a collaborative session. No session setup happens here.
2. **Workspace** — the single working screen for both modes. Left: editable session name, estimation unit, and the item list (add / remove / reorder at any time, including mid-session); items can be renamed inline from the detail panel. Right: the active item's estimation widget, or an "add an item" prompt when nothing is selected. In collaborative mode a session-code strip (code, copy, participant count) sits above it, the facilitator sees participant submission status and a reveal control instead of direct inputs, and reveal shows the aggregated range plus each participant's values with **Finalize** / **Retry round**.
3. **Join Session** *(collaborative only)* — enter name, join via code/link, connecting indicator while the peer connection establishes; a connection-failed state points to single-user mode as a fallback.
4. **Participant Estimate View** *(collaborative only)* — read-only item detail, three number inputs (Best/Likely/Worst), submit; then a waiting state, then a revealed state mirroring the facilitator's aggregated range (no finalize/retry controls).
5. **Session Summary / Report** — all finalized items with four values, export (CSV/PDF/link), saveable to a file — same layout regardless of mode.

## 8. Data model (sketch)

Session, Item, Estimate, Participant and their relationships are the domain information
model, described in full in [live-collaboration](concepts/live-collaboration.md).

## 9. Non-functional requirements

- **Real-time sync** *(Mode A only)*: submissions and reveals sync live across participants via **peer-to-peer WebRTC connections, using public STUN servers for NAT traversal and serverless signaling** — no backend operated by the app for session communication (full reasoning in **ADR-001**)
- **No-account joining** *(Mode A)*: participants join with just a name; only the session creator/team needs persistent identity for saving and reopening sessions
- **Graceful degradation** *(Mode A)*: if a peer connection can't be established, the app surfaces this clearly rather than failing silently, and points the facilitator toward Mode B as a fallback for that session
- **Session persistence**: sessions and their reports are saved and retrievable later by the team, regardless of mode
- **Export**: session summary exportable as CSV and/or shareable read-only link

## 10. Success metrics

- % of sessions that reach a finalized range for every item (completion rate)
- Reduction in symmetric-range warnings triggered over time per team (learning signal)
- Sessions reopened via a loaded file (validates the persistence feature is used)
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

Cone-of-uncertainty guidance (§6.1) shipped as part of the MVP guard set, not a future phase — moved out of this list accordingly.

## 13. Related decisions

- **ADR-001: Peer-to-peer (STUN-assisted) architecture for live collaboration, with manual entry as a first-class fallback mode** — see accompanying ADR document

## 14. Executable specs

Scenarios that pin down this PRD's behaviour as acceptance criteria live as executable
Gherkin specs under `specs/<concept>/<test level>/` (ADR-010), not as prose here — a
`.feature` file fails loudly when the app stops matching it, where a sentence in this
document could silently drift. See [live-collaboration](concepts/live-collaboration.md)
and [estimation-method](concepts/estimation-method.md) for which scenarios exist today.
