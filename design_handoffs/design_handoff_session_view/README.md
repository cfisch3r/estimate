# Handoff: Session View (estimation screen)

## Overview
The "session view" is the main screen of EstiMate where a participant reviews one estimation item at a time: description, a three-point estimate (best/most likely/worst case), a confidence prompt, a range visualization, and notes. This package documents the revised layout after a design review — nav label prominence, sidebar navigation to a session summary, and a reorderable, progress-aware items list.

## About the Design Files
The bundled HTML file (`SessionView.html`) is a **design reference** built as an interactive prototype, not production code. It is meant to be recreated in the target codebase's existing environment (React, Vue, etc.) using its established components, state management, and API integration patterns — not copied in as-is.

## Fidelity
**High-fidelity.** Colors, typography, spacing, and component states below are final. Copy text ("dsdfsdf", "adccsdf", etc.) is placeholder session/item data from testing — replace with real session and item names in production.

## Screens / Views

### 1. Item detail (default view)
**Purpose:** Estimate a single backlog item with a three-point (best/likely/worst) estimate.

**Layout:** Two-column grid, `260px` sidebar + flexible main column, `16.8px` gap, max content width `1280px`, centered, `16.8px`/`11.2px` outer padding. A full-width nav bar sits above the grid.

**Nav bar** (`.nav`):
- Left: brand mark — ladder-glyph SVG icon (two vertical strokes + one horizontal rung, `stroke: var(--color-accent)`, `stroke-width: 2.4`, 20×20) + "EstiMate" wordmark.
- Center (absolutely positioned, centered both axes): a two-line session label — small caps "SESSION" (11px, uppercase, `letter-spacing: 0.08em`, `color: var(--color-neutral-400)`) above the session code in 20px/500-weight `var(--color-text)`.

**Sidebar** (`aside`, 260px):
- Header row: "Items" (15px, 500 weight) + progress text "`{finalized}`/`{total}` finalized" (13px, `var(--color-neutral-400)`).
- Item rows, `5.6px` gap between rows: each row is a pill (`border-radius: var(--radius-md)` = 8px, `8.4px` padding) with a 6-dot drag-grip icon (14×14, `color: var(--color-neutral-500)`), an accent "▷" marker on the active row only, and the item name.
  - Active row: `border: 1px solid var(--color-accent)`, text `var(--color-text)`.
  - Inactive rows: `border: 1px solid var(--color-neutral-800)`, text `var(--color-neutral-300)`.
  - Rows are drag-reorderable (grip icon signals this — implement drag-and-drop reordering with persisted order).
- Footer link (pinned to bottom via `margin-top: auto`, separated by a `1px solid var(--color-neutral-800)` top border, `11.2px` top padding): icon + "Summary" — navigates to the session summary view. Active/inactive state changes its color between `var(--color-accent-300)` (on item view) and `var(--color-text)` (on summary view, to show current location).

**Main card** (`.card`, `16.8px` padding):
- Title: item name, 22px, 500 weight, centered.
- "Description (Markdown supported)" label + textarea (3 rows, italic placeholder styling for existing content).
- Confidence prompt, italic, 15px, `var(--color-neutral-200)`: "Would you stake your job this won't be exceeded?"
- Three-column grid (`11.2px` gap) of read-only estimate boxes — Best/Most likely/Worst case (weeks) — each a bordered box (`1px solid var(--color-neutral-700)`, `radius 8px`) with the number centered at 20px.
- Range bar: 6px-tall pill track (`var(--color-neutral-800)`), filled solid `var(--color-accent)` from 0 to the "most likely" position, a diagonal-hatched accent pattern from "most likely" to "worst case", a 14px accent dot handle at "most likely", and a vertical tick + "7.0w" label marking the midpoint/average between most-likely and worst-case. Labels below: "2w best" / "4w" (at handle) / "9w worst".
- "Finalize item" button — `.btn.btn-primary.btn-block` (outlined accent, not filled).
- "Notes (captured during discussion, Markdown supported)" label + 6-row textarea.

### 2. Summary view
**Purpose:** Review all finalized estimates for the session before closing it out.

**Layout:** Same nav + sidebar; main card is replaced by a summary card: centered "Summary" title (22px/500), a `.table`-styled data table (Item / Best / Most likely / Worst columns), and a "Back to item" secondary button (`.btn.btn-secondary`) that returns to the item detail view, preserving which item was last open.

## Interactions & Behavior
- Clicking the sidebar "Summary" link swaps the main panel from item detail to the summary table (no page navigation/reload — treat as client-side view state).
- Clicking "Back to item" on the summary view returns to the previously open item.
- Item rows are drag-to-reorder (grip icon affordance); persist new order.
- "Finalize item" marks the current item finalized, which should increment the sidebar's "`finalized`/`total`" counter and likely lock estimate inputs (not yet wired in the prototype — inputs are display-only placeholders; production should make best/likely/worst fields editable number inputs until finalized).
- Focus states: use the design system's standard `:focus-visible` (2px accent outline, 2px offset) on all interactive elements (links, buttons, draggable rows).

## State Management
- `currentView`: `'item' | 'summary'`.
- `items`: ordered list of `{ id, name, finalized, estimates: { best, likely, worst } }`.
- `activeItemId`: which item is currently open in the detail view.
- `finalizedCount` / `totalCount`: derived from `items`.

## Design Tokens
From the Nocturne design system (`styles.css`):
- Background: `--color-bg` `#161826`
- Text: `--color-text` `#e9e9ed`
- Accent: `--color-accent` `#9184d9` (used only as outlines/lines/marks, never a flood fill)
- Accent tint (links, active markers): `--color-accent-300` `#d2cefd`
- Neutral ramp: `--color-neutral-300` `#cfd3e5`, `-400` `#b2b6ca`, `-700` `#595d6c`, `-800` `#3f424d`
- Font: Inter — `--font-heading` / `--font-body`, headings capped at 500 weight
- Spacing scale (0.7× density): `--space-1` 2.8px … `--space-8` 22.4px (rows use `--space-2`/`--space-3`, sections use `--space-4`/`--space-6`)
- Radius: `--radius-md` 8px (cards, buttons, item pills)
- Shadow: `--shadow-sm` / `--shadow-md` (hairline edge + ambient darkness, no heavy drop shadows)

## Assets
- Brand mark: inline SVG (ladder/H glyph), not a raster asset — recreate as SVG or icon font glyph in the target codebase.
- Grip and summary icons: Phosphor icon set (per Nocturne spec) — "dots-six" (grip) and a Phosphor "notebook/summary"-style glyph; swap for the app's existing Phosphor icon components if already installed.

## Files
- `SessionView.html` — full interactive prototype (both item-detail and summary views, view-switching wired in-file).
