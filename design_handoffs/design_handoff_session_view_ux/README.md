# Handoff: Session View — Editable Description + Sizing Pass

## Overview
UX pass on the existing **Session View** screen (`src/screens/SessionView.tsx` in the `estimate` app) — the working screen where a facilitator selects an item and records a best/likely/worst estimate. Two changes: (1) make the item's description editable in place (it's currently read-only, set only at creation), and (2) loosen up sizing/spacing — the sidebar and active-item card currently feel cramped.

## About the Design Files
`wireframe-1a.png` (or the linked `.dc.html`, if included) is a **low-fidelity wireframe** — it shows structure and arrangement only, not final colors/type/spacing. Do not copy its boxes/dashed borders/placeholder font. The actual visual system is the app's existing **Nocturne** design system, already implemented in this codebase (`src/design/nocturne.css`, `src/components/*.tsx`) — build the change using those existing tokens and components, not new ones.

## Fidelity
**Low-fidelity for layout, but the target styling already exists and is exact** — this isn't a from-scratch visual design. Use the current `SessionView.tsx` / `ActiveItemPanel` as the base and modify it in place; don't rebuild it. Reuse `Card`, `CardTitle`, `Field`, `FieldLabel`, `Textarea`, `Button`, `GuardNote` from `src/components`.

## What's changing

### 1. Editable description
- Today: `item.description` renders as a static `<CardBody>` string, set once at item creation (`CreateSession.tsx`) and never editable from Session View.
- Change: replace that static `<CardBody>` with an editable field in `ActiveItemPanel`, directly under the title (same position it renders today) — a `Textarea` (reuse the `.input` styling already used for Notes), pre-filled with `item.description`, saved back to the item on change/blur.
- Needs a store action, e.g. `setItemDescription(id, description)` in `src/state/store.ts`, mirroring the existing `setItemNotes(id, notes)` action — same pattern, new field.
- Wireframe 1a shows this as a boxed "description [tap to edit]" area right below the item title, above the "stake your job" prompt line — keep that position; don't move description down near Notes.
- Open question for engineering/design: should this be always-editable (like Notes) or click-to-expand-then-edit? Wireframe assumed always-editable inline (simplest, consistent with how Notes already works) — flag if a click-to-edit affordance is wanted instead.

### 2. Sizing / arrangement
Current layout (`SessionView.tsx`): a flex row, sidebar `width: 220`, active item `Card` at `flex: 1`, whole thing capped at `max-width: 960, padding: 24`. Wireframe 1a keeps this same two-column skeleton but:
- Widens the working area — raise the outer `max-width` (currently 960) so the active-item card isn't so narrow, and/or drop the sidebar down to a more standard nav width proportionally smaller than the content.
- Enlarges the three estimate inputs (`Best case` / `Most likely` / `Worst case`) — currently plain 36px-tall `.input`s in a tight `gap: 8` row; wireframe gives them more padding and visual weight (each in its own boxed cell) so they read as the primary action of the screen, not a minor form row.
- Gives the Notes textarea more room at the bottom (currently `rows={5}`) — increase rows or let it flex to fill remaining height instead of a fixed row count.
- No changes to the sidebar's item-row structure (title + "Finalized" meta + accent left-border on active item) — that part wasn't flagged as a problem.

## Files already in this codebase to read before implementing
- `src/screens/SessionView.tsx` — the component being changed (`ActiveItemPanel` is the focus).
- `src/state/store.ts` — add the new `setItemDescription` action next to `setItemNotes`.
- `src/state/types.ts` — `Item` type already has a `description: string` field; no type change needed.
- `src/components/Field.tsx`, `Card.tsx`, `Button.tsx` — existing primitives to reuse, don't recreate.
- `src/design/nocturne.css` — token source (`--space-*`, `--radius-*`, `.input`, `.card`); use these variables for any new spacing/sizing, don't hardcode px values.

## Assets
No new assets. No new icons needed for this change.

## Files in this bundle
- `README.md` — this file.
- `wireframe-1a.dc.html` — the reference wireframe (structure only, ignore all visual styling in it).
