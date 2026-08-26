# Handoff: Session View — estimate range bar & guard notes

## Overview
This is a focused revision on top of the already-implemented Session View (`src/screens/SessionView.tsx`), covering two changes made in this design round:

1. **Range bar** — the best/likely/worst visualization now labels its "most likely" and "90% confidence" marks with stacked value + caption callouts (instead of tiny unlabeled text), and the fill is split into three zones whose color intensity increases left to right to communicate that confidence grows as you move from the optimistic end toward the 90%-confidence point and worst case.
2. **Guard notes** — the symmetric-range, invalid-range, and ordering warnings (previously a single small line of 12px text) are now a tinted banner with a bold headline and a larger icon, matching the "more prominent" request.

Nothing else on the screen changed — sidebar, header, description/notes fields, and the summary view are unchanged from the existing implementation and prior handoffs (`design_handoffs/design_handoff_session_view/`, `design_handoffs/design_handoff_session_view_ux/`).

## About the Design Files
`SessionView.html` is a **design reference** — an HTML/CSS prototype showing the exact intended look, not production code to copy in. Recreate it inside `ActiveItemPanel` in `src/screens/SessionView.tsx`, reusing the existing `Card`, `Field`, `Input`, `Button`, `GuardNote` components and the existing `RangeBar` component (or a revised version of it — see below) rather than introducing new ones.

## Fidelity
**High-fidelity.** Colors, typography, spacing, and states below are final. The example data (best 2w / likely 4w / worst 6w / 90% CI 5.7w, "Add CSV export to reports") is placeholder — wire it to the real store values as today.

## Screens / Views

### Item detail — range bar
**Layout:** unchanged two-column grid. Inside the card, the range bar sits in a `56px 4px 24px` padded wrapper (was `20px 4px 24px` — the extra top padding makes room for the callouts).

**Track:** `14px` tall (was `6px`), `border-radius: 7px`, split into three flush-adjacent absolutely-positioned segments (`display:flex` inside the rounded, `overflow:hidden` container), each `height:100%`:
- Segment 1, `0%` → most-likely position: `background: var(--color-accent-800)` (least certain zone)
- Segment 2, most-likely → 90%-CI position: `background: var(--color-accent-600)`
- Segment 3, 90%-CI position → `100%`: `background: var(--color-accent)` (most certain zone, full-strength accent)

Segment widths are `%` of the best→worst span: `expectedPct = (likely-best)/(worst-best)*100`, `ci90Pct = min(((ci90-best)/(worst-best)*100), 80)` — **the 80% cap is intentional**: it keeps the 90%-confidence callout and marker from colliding with the worst-case label when the CI90 value sits very close to the worst-case end. Segment 1 width = `expectedPct`; segment 2 width = `ci90Pct - expectedPct`; segment 3 width = `100 - ci90Pct`.

**Markers:** both the "most likely" and "90% confidence" points use the same `18×18px` marker — `border-radius:3px`, `background:var(--color-accent)`, `box-shadow:0 0 0 3px var(--color-bg)`, `transform:translate(-50%,-50%) rotate(45deg)`, vertically centered on the track (`top:50%`), horizontally positioned at their (clamped, for CI90) percentage.

**Callouts:** stacked value+caption boxes, `border-radius:var(--radius-sm)`, `padding:5px 10px`, positioned `top:-52px` above the track, `transform:translateX(-50%)`, `white-space:nowrap`:
- **Most likely** (now the muted, secondary label): `background:var(--color-bg)`, `border:1px solid var(--color-neutral-700)`; value `font:600 14px var(--font-heading)` in `var(--color-text)`; caption `font-size:10px` in `var(--color-neutral-400)`, text "most likely" (lowercase).
- **90% confidence** (now the prominent label): `background:var(--color-accent-900)`, `border:1px solid var(--color-accent-700)`; value `font:700 15px var(--font-heading)` in `var(--color-accent-300)`; caption `font-size:10px` in `var(--color-accent-400)`, text "90% confidence".

**End labels:** below the track (`margin-top:16px`), a flex row `justify-content:space-between`. Each end is now a stacked value+caption (was a single small line): value `font:600 16px var(--font-heading)` in `var(--color-text)` ("2w" / "6w"), caption `font-size:11px` in `var(--color-neutral-400)` ("best case" / "worst case").

### Item detail — guard notes
Applies to all three below-the-bar guard states: symmetric-range warning, invalid-range error, and out-of-order warning (the three per-field "consider rounding" hints under the Best/Likely/Worst inputs are unchanged — still the small inline `GuardNote` line, left alone as this round only targeted the more prominent, standalone warnings).

Each is a banner:
- Container: `display:flex; align-items:flex-start; gap:12px; padding:12px 14px; border-radius:var(--radius-md)`, `background: color-mix(in srgb, #e0ac67 14%, transparent)`, `border: 1px solid color-mix(in srgb, #e0ac67 35%, transparent)`.
- Icon: Phosphor "warning-circle" (filled), `24×24px` (was `13×13px`), `fill:#e0ac67`.
- Headline: `font:600 14px/1.3 var(--font-heading)`, `color:#e0ac67` — "Symmetric range" / "Invalid range" / "Out of order".
- Body: `font-size:13px; line-height:1.5; color:var(--color-neutral-200)` — the existing explanatory copy, unchanged, now on its own line below the headline.

**Important implementation note:** `#e0ac67` is written as a **literal hex value**, not `var(--color-warning)`. `--color-warning` is defined in this app's own extended `src/design/nocturne.css`, not in the ported-as-is core Nocturne token file — if your build only links the core stylesheet, `var(--color-warning)` resolves to nothing. Either keep the literal, or confirm `--color-warning` is defined wherever this renders.

## Interactions & Behavior
No new interactions — all existing behavior (typing into best/likely/worst updates the bar and guard notes live, Finalize disabled until valid, drag-to-reorder sidebar, Summary/back navigation) is unchanged. The range bar and guard notes are purely presentational updates driven by the same `best`/`likely`/`worst`/`ci90` values as today.

## State Management
No changes to state shape. Continue deriving `expectedPct`, `ci90Pct` (with the 80% clamp), and the guard booleans (`symmetricGuardFired`, `validationError`, `orderingWarning`) exactly as `ActiveItemPanel` does today; just feed them into the new markup/styles above instead of the old thin single-color bar and 12px warning line.

## Design Tokens
- Track segments: `--color-accent-800`, `--color-accent-600`, `--color-accent` (full)
- Marker/callout accent: `--color-accent`, `--color-accent-900`, `--color-accent-700`, `--color-accent-300`, `--color-accent-400`
- Neutral text/borders: `--color-text`, `--color-neutral-200`, `--color-neutral-400`, `--color-neutral-700`, `--color-bg`
- Guard note warning color: literal `#e0ac67` (see implementation note above)
- Radius: `--radius-sm` (callouts, guard note), `var(--radius-md)` (guard note container), custom `7px` (track — between `--radius-sm` 4px and `--radius-md` 8px, sized to the 14px track height)
- Spacing: `--space-3`, `--space-4` (guard note internals use literal px for pixel-exact callout/marker positioning, consistent with the existing `RangeBar` component's approach)

## Assets
Phosphor "warning-circle" (filled), inlined as SVG — same icon already used by the existing `GuardNote` component, just larger (24px vs 13px). No new assets.

## Files
- `SessionView.html` — static HTML/CSS reference of the item-detail view with the new range bar and guard note, plus the unchanged summary view (click "Summary" / "Back to item" to toggle — this toggle is a prototype convenience, not a spec).
- `reference/nocturne-styles.css` — the core Nocturne token/component stylesheet this reference links to.
