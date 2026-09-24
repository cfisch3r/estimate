# Handoff: Workspace Screen Redesign (single-user, facilitator, participant)

## Overview
A structural redesign of the three "workspace" screens in EstiMate's single-user and live-collaboration flows:
1. **Single-user Workspace** (`Workspace.tsx` in non-live mode / `ActiveItemPanel`)
2. **Facilitator Workspace** (`Workspace.tsx` in live mode / `LiveFacilitatorPanel`)
3. **Participant Estimate View** (`ParticipantEstimateView.tsx`)

The redesign addresses four things, applied consistently across all three:
- Merge the item list and the item-detail panel into **one session card**, with session name, unit and Summary moved to a shared top bar (single-user and facilitator screens only — the participant screen has no item list, see below).
- **Group** the three-point estimate fields, the phase picker and the range bar each in their own bordered section with a heading and a click-to-open **info icon** explaining that section.
- On the single-user screen, **integrate item-to-item navigation with the finalize action**: a "←" arrow always navigates to the previous item; the primary button becomes "Finalize & next →" once the entered range is valid, and reads "Finalize & view summary" on the last item.
- Give the item list its own **fixed-height, independently scrolling region** so a long backlog no longer grows the whole card — the progress label and "Add an item" row stay pinned outside the scroll area.

## About the Design Files
The bundled file (`Workspace Wireframe.dc.html`) is a **design reference** — open it in a browser to see every option discussed. It is NOT production code and must not be copied verbatim into the app. The task is to recreate this structure in the app's real React + Nocturne-design-system stack, following the codebase's own component conventions (`Card`, `Button`, `Field`, `Input`, `Select`, `Tag`, the existing `RangeBar` and `PhasePicker` components).

## Fidelity
**Low-fidelity (wireframe).** This is a sketchy, black-and-white structural wireframe — box placement, grouping, copy and interaction flow are the point; colors, fonts, icons and exact spacing are NOT final and must come from the app's existing Nocturne design system and component library, not from this file's sketch styling.

## In scope for this handoff
Three specific options from the wireframe canvas, each a complete screen:
- **`#5a`** — Single-user Workspace
- **`#6a`** — Facilitator Workspace (live mode)
- **`#7a`** — Participant Estimate View

(Other options in the file, e.g. `#1a`–`#4a`, are earlier iterations of the same redesign kept for context — they are superseded by `5a`/`6a`/`7a` and not in scope.)

---

## Screen 1 — Single-user Workspace (`#5a`)
**Purpose:** the facilitator (or solo user) works through a backlog of items one at a time, entering a best/likely/worst range for each.

**Layout:** one outer card (`background: var(--color-surface)`, rounded, single elevation shadow — no nested card shadows). Inside:
- **Top bar**: session name (inline-editable text), a "·" separator, unit dropdown (Hours/Days/Weeks), a flexible spacer, then a ghost-styled "Summary" button, right-aligned.
- **Body**: two-column grid, `280px` sidebar + flexible detail panel, split by a single vertical rule (no second card border).
  - **Sidebar**: "Items" label + "`X`/`Y` finalized" count, then the item list, then a pinned "+ Add an item" input/button row.
    - **Item list scroll region**: fixed height (e.g. `360px`), `overflow-y: auto`, independent of the detail panel's height. A bottom fade hints there are more rows. The progress label above and add-item row below are NOT part of the scrolling region.
    - Each row: drag handle, a checkmark icon if finalized (or a "▷" marker if active and not finalized), title (truncates with ellipsis), and a remove "✕" that arms into a "Confirm" label on first click (second click within ~2.5s removes the item).
  - **Detail panel** (no border/shadow of its own — sits flush against the sidebar):
    - Click-to-edit title (click text → text input, Enter/blur commits, Escape cancels).
    - Description field (textarea, "Markdown supported").
    - **Three-point estimate group**: bordered box, heading "Three-point estimate" + info icon (click opens a popover explaining the method), three side-by-side numeric fields (Best case / Most likely / Worst case, each labeled with the current unit). An inline warning appears if values aren't ascending.
    - **Phase group**: bordered box, heading "Phase" + info icon, containing the app's existing cone-of-uncertainty **Phase Picker** control unchanged.
    - **Range group**: bordered box, heading "Range" + info icon, containing the app's existing **Range Bar** (guidance-aware, min/expected/CI90/max) unchanged — or a placeholder note ("Enter best, most likely and worst case above…") when the range isn't valid yet.
    - Notes field (textarea, flexes to fill remaining space).
    - **Nav row**: a "←" icon button (always enabled unless first item, just navigates — no finalize side effect) + a full-width primary button whose label is:
      - `Finalize item` — disabled, until best/likely/worst are valid
      - `Finalize & next →` — valid, not the last item (clicking finalizes AND advances to the next item)
      - `Finalize & view summary` — valid, last item
      - `Update & next →` / `Update & view summary` — same as above but the item was already finalized once

**Empty states** (shown in place of the detail panel when there's no active item): "Add an item to get started" (no items), "All items finalized" (every item done), "Select an item to estimate" (items exist, none selected).

---

## Screen 2 — Facilitator Workspace, live mode (`#6a`)
**Purpose:** same shell as Screen 1, but the facilitator never types values — they come from participants submitting over the peer-to-peer session.

**Layout:** identical outer card/top-bar/sidebar structure as `#5a`, plus one addition and one substitution:
- **Session strip**: a full-width bar directly under the top bar (spans both columns) showing "Session code", the code itself, a copy action, a flexible spacer, and a connection tag ("`N` participants connected" / "Disconnected" / "All participants disconnected" / "Waiting for participants…"), with a "Reconnect" ghost button when disconnected.
- **Three-point estimate group is replaced by a "Participant estimates" group**: bordered box, heading + info icon, listing each participant by name (or "Teammate N" if unnamed) with either a Submitted/Waiting tag (before reveal) or their actual best/likely/worst values (after reveal).
- **Range group**: same as Screen 1, but only appears once the round is revealed, and its values are the *aggregate* across all submissions (existing `aggregateEstimates` logic), not a single person's entry.
- **Nav row** varies by round state:
  - Not revealed: single button, "Reveal estimates" (disabled until at least one submission; shows the submitted count once enabled). No "←"/finalize yet.
  - Revealed, not finalized: "←" + "Finalize & next →" (primary) + a secondary "Retry round" button (starts a new round for this item).
  - Already finalized: "←" + "Update & next →"; Retry hidden.

---

## Screen 3 — Participant Estimate View (`#7a`)
**Purpose:** a single participant enters their own best/likely/worst for whichever one item the facilitator currently has open. There is no item list on this screen — the facilitator drives which item is showing — so **the session-card merge, top bar and prev/next nav from Screens 1–2 do not apply here.**

**Layout:** a single centered card (max-width ~560px in the real app), no sidebar:
- Kicker: the **session name**, with the join code shown secondary in muted parentheses beside it — e.g. "Sprint 42 estimates (7F QK 2M)" (previously the kicker showed only the raw code; the name should lead).
- Item title, then description (if any).
- **Three-point estimate group**: same bordered-box + info-icon treatment as Screen 1's group, wrapping the Best/Most likely/Worst fields.
- The existing italic line, "Would you stake your job this won't be exceeded?", unchanged, between the estimate group and the phase picker.
- **Phase group**: bordered box + info icon around the existing Phase Picker.
- **Range group**: bordered box + info icon around the existing Range Bar (or its placeholder note).
- Primary button: "Submit estimate" (Screen 1's nav-integration doesn't apply — there's exactly one action here, not a sequence of items).
- Status line below the button ("`N` of `M` teammates have submitted so far.").

This screen also has two other round states not detailed pixel-by-pixel in the wireframe but which should get the same group + info-icon treatment on their own range group:
- **Waiting** (after this participant submits, before reveal): replace the estimate/phase groups with the submitted values + a "revise" pencil icon, keep spinner/status copy as in the current app.
- **Revealed**: replace the estimate/phase groups with the aggregate Range group (same as Screen 2's revealed range) + the per-teammate list of submitted values, keep existing copy.

---

## Interactions & Behavior
- **Info icons**: click to open, not hover — a small popover anchored to the icon, explaining that section in 2–3 sentences. Only one popover open at a time. (Rationale from design discussion: click is more robust than hover for touch and for longer explanatory text.)
- **Remove item**: first click arms a "Confirm" state (visually distinct, e.g. warning-toned), second click within ~2.5s removes the item; the arm auto-expires if not confirmed.
- **Item list scroll**: fixed-height region with real `overflow-y: auto` — this was chosen over "match the right panel's height" (also explored, see `#5b` in the wireframe) because the latter makes the number of visible rows shift depending on which item's content is open.
- **Prev/next + finalize integration** (Screens 1–2 only): "←" never finalizes, only navigates (no need to finalize to go back — notes/description already autosave regardless of finalize status). The forward action is folded into the primary "Finalize" button rather than being a separate arrow.

## State Management
No new persisted/store state is required beyond what the app already tracks (items, best/likely/worst, finalized flag, phase, live round/roster). New **UI-only** state per screen:
- Which info popover (if any) is open (one shared key: `'estimate' | 'phase' | 'range' | null`).
- Which item row (if any) is armed for delete confirmation, plus its auto-expiry timer.
- Scroll position of the item-list region (native browser scroll state, nothing to persist).

## Design Tokens
This wireframe intentionally carries no real tokens (sketch only). Implement using the app's existing Nocturne tokens/components:
- Surfaces/borders: `var(--color-surface)`, `var(--color-divider)`, `var(--radius-md)`/`var(--radius-lg)`, `var(--shadow-sm)`
- Text: `var(--color-text)`, `var(--color-neutral-400)` (muted labels/captions)
- Accent: `var(--color-accent)` + its ramp for interactive/active states
- Components to reuse as-is: `Card`, `Button` (`btn-primary`/`btn-secondary`/`btn-ghost`/`btn-icon`), `Field`/`FieldLabel`/`Input`/`Select`/`Textarea`, `Tag`, `RangeBar`, `PhasePicker`, `GuardNote`
- Icons: Phosphor icons, matching the app's existing icon usage (e.g. `PencilSimple`, `CaretLeft`/`CaretRight`, `X`, `Plus`, `CheckCircle`, an info-circle glyph for the new info icons)

## Assets
None — all icons in the wireframe are placeholder glyphs/unicode standing in for the app's real Phosphor icon set.

## Files
- `Workspace Wireframe.dc.html` — the full wireframe canvas. Open directly in a browser. Jump to `#5a`, `#6a`, `#7a` (URL hash) for the three in-scope screens; other options in the file are earlier iterations, not in scope.

## Source files this maps to (same repo)
- Screen 1: `src/screens/Workspace.tsx` (`ActiveItemPanel`, `ItemDetailShell`), `src/screens/SessionSidebar.tsx`
- Screen 2: `src/screens/Workspace.tsx` (`LiveFacilitatorPanel`, `LiveSessionStrip`), `src/screens/SessionSidebar.tsx`
- Screen 3: `src/screens/ParticipantEstimateView.tsx` (`EstimateForm`, `EstimatingPanel`, `WaitingPanel`, `RevealedPanel`)
- Shared components: `src/components/RangeBar.tsx`, `src/components/PhasePicker.tsx`, `src/components/Field.tsx`, `src/components/Button.tsx`, `src/components/Card.tsx`, `src/components/Tag.tsx`
