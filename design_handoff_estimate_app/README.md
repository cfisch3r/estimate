# Handoff: EstiMate — Live Three-Point Estimation

## Overview
EstiMate lets a dev team run three-point (best/likely/worst) estimation sessions, either live/collaborative (participants join and submit independently) or manual entry (facilitator types values directly, e.g. solo estimation). This bundle covers the full flow: create session → join → facilitate/estimate → reveal → summary → history.

## About the Design Files
The included `EstiMate Clickable Prototype.dc.html` is a **design reference** built in HTML — a clickable prototype showing intended layout, flow, and interaction, not production code to copy directly. The task is to **recreate this design in the target codebase's existing environment** (React, Vue, native, etc.) using its established patterns and libraries — or, if no environment exists yet, choose the most appropriate framework and implement there. Open the file directly in a browser to click through the live behavior.

## Fidelity
**High-fidelity for visual style, low-fidelity for data/backend.** Colors, typography, spacing, and component styling follow the bound "Nocturne" design system precisely (see Design Tokens below) — recreate these pixel-perfectly using the codebase's design system if one exists, or port Nocturne's tokens if not. All interactivity is simulated client-side with local component state — there is no real backend, peer-to-peer networking, or persistence; that logic needs to be designed and built by engineering per the PRD/ADR (also referenced below, not included in this bundle — ask the design/product owner for `PRD-estimation-app.md` and `ADR-001-live-collaboration-architecture.md`).

## Screens / Views

### 1. Create Session
- **Purpose**: Facilitator names a session, builds the backlog of items to estimate, and picks a mode.
- **Layout**: Single column, max-width 640px, centered. Three stacked cards (session name, items, mode) + full-width primary button.
- **Components**:
  - Session name: single-line text input in a card.
  - Items list: each item is a row with a drag handle (6-dot icon, draggable for reordering), title, optional description shown below title in muted text, edit (pencil) and remove (x) icon buttons. Clicking edit swaps the row for an inline form: title input + multi-line description textarea (8 rows... actually 6 rows here, Markdown supported per placeholder) + Cancel/Save buttons.
  - Add item: text input + "Add" button (or Enter key) appends a new item with empty description.
  - Mode: two side-by-side selectable tiles (radio behavior) — "Live Collaborative" (team joins & submits live) and "Manual Entry" (facilitator types values in directly). Selected tile gets an accent-colored border and filled radio dot.
  - Primary button: "Create session". Live mode → goes to Join Session. Manual mode → skips straight to the combined Session View (screen 3) since there's no one else to join.

### 2. Join Session (Live mode only)
- **Purpose**: A participant enters their name to join a live session.
- **Layout**: Single column, max-width 420px, centered.
- **Components**: Session code input, name input (both in one card), "Join" primary button, and a "Connecting to peers…" loading indicator (spinner icon + text) shown for ~900ms after clicking Join (simulates P2P handshake — see ADR-001).
- On join, routes to the Participant Estimate View (screen 4).

### 3. Session View (combined Facilitator + Estimate view)
- **Purpose**: This is the working screen during the session — browse/select items, and either watch live submission status or type manual estimates directly, then reveal or finalize.
- **Layout**: Two columns — left sidebar (220px) lists all items; right panel (flex:1) shows the selected/active item in a card.
- **Components**:
  - Item queue (left): each item is a row; the active item is highlighted with an accent border and a "play" icon; clicking any row makes it active.
  - Active item card (right): title, then an editable multi-line **Notes** textarea (labeled "Notes (captured during discussion, Markdown supported)", 8 rows, resizable) — meant for the facilitator to capture live discussion detail during the session, distinct from the original item description.
  - **Live mode**: shows "Submissions (N / 5)" with 5 participant-initial tags (checkmark = submitted), a "Simulate participant submit" button (dev/demo aid — remove in production, real version listens for actual submissions), and a "Reveal" button → goes to Reveal screen.
  - **Manual mode**: shows Best/Likely/Worst number inputs (unit: weeks) directly in this card, and a "Finalize item" button that records the values and returns to the queue — no Reveal step (Reveal is disabled/greyed out in the top step nav for Manual mode, since there's only one estimator).
  - Screen label switches: "Facilitator Session View" (Live) vs. "Session View — Manual Entry" (Manual).

### 4. Participant Estimate View (Live mode only)
- **Purpose**: A joined participant privately enters their own Best/Likely/Worst estimate for the active item.
- **Layout**: Single column, max-width 560px, centered.
- **Components**: Item title + description shown read-only in a card, three side-by-side number inputs (Best case / Most likely / Worst case, unit weeks), a bias-guard hint below them ("Would you stake your job this won't be exceeded?" — nudges against overconfident narrow ranges, see PRD §6), and a "Submit" primary button that returns to the Session View.

### 5. Reveal View (Live mode only; disabled/hidden in Manual mode)
- **Purpose**: Show all participants' submitted ranges together once everyone has submitted, so the group can discuss before finalizing.
- **Layout**: Single column, max-width 700px.
- **Components**: One horizontal range bar per participant (colored bar segment positioned/sized by best–worst range on a shared 0–100% track), the current user's own row picked out in the accent color with a warning icon if their range is an outlier, a summary card with computed Group range / Expected / CI90 (90% confidence interval — needs real statistical computation per PRD §6, currently hardcoded), and two actions: "Re-estimate" (back to Session View for another round) and "Finalize" (records the item as done, returns to Session View).

### 6. Session Summary / Report
- **Purpose**: Review all finalized items for the session, export results.
- **Layout**: Single column, max-width 760px.
- **Components**: Header with session name + "Export" button (in the prototype this is a placeholder alert; real version should offer CSV / PDF / shareable link per PRD §7.6). Below it, one row per finalized item showing title, a range bar visualization, and the recorded range/expected text. Shows an empty state ("No items finalized yet.") if nothing has been finalized. A "View session history" button links to screen 7.

### 7. Session History
- **Purpose**: Browse past sessions and reopen their summaries.
- **Layout**: Single column, max-width 640px.
- **Components**: A search input filtering by session name (client-side substring match in the prototype), and a list of session rows (name + mode/item-count/date metadata). The current in-progress session appears pinned at the top of the list once at least one item has been finalized, marked "(current)".

## Interactions & Behavior
- Top of every screen: a row of 7 small dots (one per screen) acting as direct-jump navigation for review purposes only — **this is a prototype affordance, not part of the real product**; do not build a "screen picker" into the shipped app. Screen 5 (Reveal)'s dot is dimmed and non-clickable when the session mode is Manual Entry.
- Drag-and-drop reordering on the item list in Create Session: native HTML5 drag events (dragstart/dragover/drop/dragend); dragged row dims to 40% opacity, drop target gets an accent outline ring.
- All transitions are instant (no animation) except the simulated "Connecting to peers…" join delay (~900ms).
- Form validation: none is implemented in the prototype (e.g. empty session name, non-numeric estimate inputs are not blocked) — real implementation should validate: session name required, item titles required and non-empty, estimate values numeric and best ≤ likely ≤ worst.
- The "bias-guard" copy (job-stakes question, symmetric-range warnings referenced in earlier design rounds) should be revisited with real-time validation logic per PRD §6 — currently just static hint text.

## State Management (as modeled in the prototype's component state — for reference, not final architecture)
- `screen`: which of the 7 screens is showing.
- `sessionName`, `items` (array of `{title, desc}`), `mode` ('live' | 'manual').
- Item list editing: `editingIndex`, `editTitle`, `editDesc`; drag state: `dragIndex`, `dragOverIndex`.
- `participantName`, `isJoining`.
- `activeItemIndex` (which item is being discussed/estimated), `submittedCount`, `meiSubmitted` (demo-only simulated participant).
- `estBest`, `estLikely`, `estWorst` (current estimate inputs — shared between Manual-mode facilitator entry and Live-mode participant entry in this prototype; a real implementation needs per-participant, per-item estimate records, not single shared fields).
- `finalized`: array of `{title, range}` for the Summary screen.
- `historySearch`: search filter text for History screen.

Real implementation will need: persisted sessions and items; per-participant submitted estimates (not just a count) with computed aggregate stats (group range, expected value, CI90 — see PRD §6 for the specific estimation math); real-time sync for Live mode (see ADR-001 for the peer-to-peer + manual-entry-fallback architecture decision); session history persisted per team/user.

## Design Tokens (Nocturne design system)
Full token sheet is in `_ds/nocturne-a669f585-f3fe-40ab-a191-bf5c3b3d887c/styles.css` (bundled). Key values:
- **Ground**: `--color-bg` #161826 (dark, near-neutral blue-grey)
- **Text**: `--color-text` #e9e9ed
- **Accent**: single accent #9184d9 (blurple), used as outlines/lines/glows, never as a flood fill. Tonal ramps 100–900 for neutral, accent, and accent-2 (accent-2 is a mono-scheme stand-in, visually same as accent).
- **Type**: Inter for both headings (`--font-heading`) and body (`--font-body`), heading weight capped at 500 (never bolder).
- **Spacing/radius**: compact scale, density 0.7×, 8px base radius — use `--space-*` / `--radius-*` variables, never raw px.
- **Components used**: `.btn` (`.btn-primary` outlined never filled, `.btn-secondary`, `.btn-ghost`, `.btn-icon`, `.btn-block`), `.tag` (`.tag-accent`, `.tag-outline`, `.tag-neutral`), `.field` + `.input` (incl. `<textarea class="input">` for multi-line), `.radio` + `.dot`, `.card` (`.card-kicker`, `.card-title`, `.card-body`, `.card-meta`, `.elev-sm`), `.hr`.
- Icons: Phosphor icon set (loaded via CDN in the prototype; use the codebase's existing Phosphor install/package if present).

## Assets
No custom images. Icons are Phosphor (regular weight), loaded via `https://unpkg.com/@phosphor-icons/web`. All avatars/initials are text-in-tag placeholders (e.g. "P", "J", "M") — no avatar images.

## Files
- `EstiMate Clickable Prototype.dc.html` — the full interactive prototype (all 7 screens, all interactions described above). Open directly in a browser.
- `support.js` — runtime helper required by the prototype file; not part of the design, just makes the `.dc.html` file loadable standalone.
- `_ds/nocturne-a669f585-f3fe-40ab-a191-bf5c3b3d887c/` — the complete Nocturne design system: `styles.css` (token sheet + component CSS, canonical source for all values above) and reference component/foundation pages.
