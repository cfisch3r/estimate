# Handoff: EstiMate — Mode-Based Flow Refactor

## Overview
This supersedes the entry flow in the previous handoff (`design_handoff_estimate_app`). Session creation is no longer a separate step before the working screen. The app now opens on a **mode-selection** screen, and both single-user and collaborative modes land directly on one **workspace** screen (item list + estimation widget). Collaborative mode also replaces the facilitator's manual number inputs with a submit/reveal flow against participants' own estimates, and adds a matching participant-side estimating/waiting/revealed flow.

## About the Design Files
`EstiMate Screens.dc.html` is a **design reference** — a static, annotated canvas of every screen and state in HTML/CSS, not production code. The task is to recreate these screens in the app's real React codebase (`src/screens`, `src/components`, `src/state/store.ts`), using its existing component library (`Button`, `Card`, `Field`, `RadioTile`, `RangeBar`, `Tag`, etc.) and the ported Nocturne stylesheets in `src/design/`. Do not copy the HTML/inline-styles directly — rebuild as React components consuming design tokens the way the existing screens already do.

## Fidelity
High-fidelity for visual style (colors, spacing, type, component classes all follow Nocturne exactly — see Design Tokens). Low-fidelity for data: participant names, submission counts, and aggregated numbers are hardcoded illustrative examples. The real aggregation math (median/mean, CI90) should use the existing `src/calc/` module (`ci90.ts`, `aggregate.ts`, `estimate.ts`) rather than the mocked numbers shown here.

## Screen map

### 0 · Mode selection (new)
Entry screen, replaces going straight to Create Session.
- Centered column, max ~420px: logo mark, "EstiMate" wordmark, one-line tagline.
- Three stacked option rows (`.card.elev-sm`, row layout, icon + title + description + chevron), each a full click target:
  1. **Start single-user mode** (`ph-user`) → Workspace, manual/single-user.
  2. **Start collaborative estimation** (`ph-users-three`) → Workspace, live mode (generates a session code).
  3. **Join a collaborative session** (`ph-sign-in`) → existing Join screen.

### 1 · Workspace (replaces Create Session + Session View)
One screen, two states depending on whether an item is selected, used by both single-user and (with additions) collaborative mode.
- Header: brand mark + a `.tag` showing `Single-user` or `Live` (collaborative also gets a full-width strip below the header: session code + copy button + `N participants connected` tag).
- Left column (300px): editable session-name text (click-to-edit, pencil icon) + unit select (Hours/Days/Weeks) above a `session-sidebar` block:
  - Item rows: drag handle, finalized check icon (`ph-check-circle`, accent) when done, active-row accent border + `▶` marker, per-row remove (`x`) button. Reordering is drag-and-drop on the handle (existing `ItemList` behavior).
  - "Add an item" input + button pinned under the rows — items can be added/removed/reordered from this screen at any time, including mid-session.
  - "Summary" link at the bottom.
- Right panel: the active item's estimation widget (**1**) or an empty state (**1b**) prompting to add/select an item when nothing is active.
- **1 (single-user, item selected)**: title, description textarea, Best/Likely/Worst number inputs, computed range bar, "Finalize item" button, notes textarea. Same fields the old manual-mode Session View had.
- **1b (nothing selected)**: centered icon + "Add an item to get started" message, no widget.

### 1c / 1d · Workspace, collaborative mode (facilitator side)
Same shell as screen 1, but the facilitator never types estimate values directly.
- **1c — waiting for estimates**: title + description (still facilitator-editable). A "Participants" list: one row per participant, name + `Submitted` (`tag-accent`) or `Waiting` (`tag-neutral`) status — no values shown yet. A "Reveal estimates" primary button, enabled once at least one participant has submitted. Notes textarea below.
- **1d — revealed** (after clicking Reveal): the same card now shows the aggregated range bar (computed from submitted estimates — best/likely/worst + CI90, via `src/calc`), then a "Participant estimates" list with each participant's own best/likely/worst values (or "No response" if they didn't submit before reveal). Two actions: **Finalize item** (records the aggregated result, same as manual mode's finalize) and **Retry — start new round** (clears submissions and returns to the 1c waiting state for this item).

### 2 / 2b · Join session — unchanged from previous handoff (session code + name form; 2b is the connection-failed state).

### 3 · Summary — unchanged from previous handoff, renumbered.

### 4 / 4b · Session history — unchanged from previous handoff, renumbered.

### 5 · Participant lobby — unchanged (waiting for facilitator to start the first item), renumbered.
### 5b · Participant — connection lost — unchanged, renumbered.

### 5c / 5d / 5e · Participant estimating flow (new — this was previously an unimplemented placeholder)
- **5c — estimating**: item title + read-only description, three Best/Likely/Worst number inputs (empty, participant fills these in — participant never sees the facilitator's values), "Submit estimate" primary button, small status line ("N of M teammates have submitted so far").
- **5d — waiting for reveal** (after submit): shows the participant's own submitted values in a read-only row (with an edit pencil, in case they want to change it before reveal), and a spinner + "Waiting for the facilitator to reveal…" — no visibility into other participants' values at this stage.
- **5e — revealed**: same aggregated range bar as the facilitator's 1d, plus the full "Participant estimates" list including the participant's own row (marked "(you)"). No Finalize/Retry controls here — those are facilitator-only; a footnote reads "Waiting for the facilitator to finalize or start a new round."

## Interactions & Behavior
- Mode selection routes: single-user/collaborative → Workspace; join → Join screen. Collaborative mode additionally calls session-code generation (`generateSessionCode`, `src/network`) and connects (`useNetworkSession`), matching what `CreateSession.tsx`'s live path already does today — that logic just needs to move earlier, before any item exists.
- Item CRUD (add/edit/remove/reorder) is available on the Workspace screen at all times, not gated behind a separate creation step — reuse the existing `ItemList` component and store actions (`addItem`, `updateItem`, `removeItem`, `reorderItems`) as-is; they don't need to change.
- Reveal is gated: disabled until `submittedCount >= 1` for the active item.
- Retry (1d → 1c) needs a new store action that clears all participant submissions for the active item and re-broadcasts a "round started" event, distinct from re-opening an already-finalized item.
- Finalize (from 1c/1d or from single-user's widget) marks the item done and advances the sidebar's finalized count/checkmark, same as the existing manual-mode finalize.

## State Management (new/changed)
- `currentScreen` needs a `mode-select` entry as the initial screen, plus the workspace subsumes what were separate `create` and `session` screens (kept as one component with an `activeItemId | null` state driving 1 vs 1b/1c/1d).
- Per-item, collaborative mode needs: `submissions: { participantId, best, likely, worst, submittedAt }[]` and a `revealed: boolean` flag, reset on Retry.
- Facilitator's "Participants" list and participant's own submitted-state read from the same `submissions` array — no separate model needed.

## Design Tokens
All from the bound Nocturne stylesheet (`src/design/nocturne.css`, ported verbatim) — no new colors, spacing, or type introduced. Notably reused in the new screens:
- `--color-accent` / `--color-accent-300` for active states, finalized checks, and the Live tag.
- `.tag-accent` (Submitted / Live / participants-connected) vs `.tag-neutral` (Waiting / Single-user).
- `--space-1..8`, `--radius-sm/md/lg` for all spacing/radii — do not use `--space-5` or `--space-7`, they don't exist in the scale.
- `.card`, `.card-kicker/-title/-body/-meta`, `.session-sidebar*`, `.range-bar*`, `.guard-note*` classes unchanged from `src/design/`.

## Assets
Phosphor icons only (`ph-user`, `ph-users-three`, `ph-sign-in`, `ph-check-circle`, `ph-pencil-simple`, `ph-x`, `ph-dots-six-vertical`, `ph-copy`, `ph-notebook`, `ph-circle-notch` for spinners, `ph-list-checks`, `ph-arrow-right`). No raster images or custom icons.

## Files
- `EstiMate Screens.dc.html` — open directly in a browser; every screen described above is laid out on one pannable canvas, labeled by number.
- `app-css/` — the app's ported Nocturne CSS files this file links (`nocturne.css`, `radio-tile.css`, `range-bar.css`, `session-sidebar.css`) — for reference only; the real app already has these in `src/design/`.
- `_ds/` — the bound Nocturne design-system bundle used to render this file standalone; not part of the app's own code.
