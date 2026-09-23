# Handoff: Cone-of-Uncertainty Phase Picker + Guidance-Aware Range Bar

## Overview
Per PRD section 6.1, EstiMate should let a user compare their three-point estimate (best case / most likely / worst case) against the industry heuristic ranges from the "cone of uncertainty," selected per item via a project-phase picker. This bundle covers two pieces:

1. **Phase picker** ("Cone Slider") — lets the user pick which project phase they're at (5 discrete levels), shown as a position along the cone-of-uncertainty curve.
2. **Range bar** — the existing `RangeBar` component (best/most likely/90% confidence/worst), extended to show the selected phase's guidance range for comparison, including the edge case where the user's own range already exceeds guidance.

## About the Design Files
The files in this bundle (`.dc.html`) are **design references** built in an internal prototyping tool — they are NOT production code and must not be copied verbatim into the app. They render correctly stand-alone (open in any browser) so you can inspect exact positions, colors, and behavior, but the implementation task is to **recreate this design in the app's real stack** (React + the existing `RangeBar.tsx` / `range-bar.css`), following the codebase's own component conventions.

## Fidelity
**High-fidelity.** Colors, spacing, typography, and interaction behavior (drag/snap, hover reveal, collision avoidance between labels) are final — implement pixel-for-pixel where practical, adapting only to fit the app's actual `RangeBar` component API.

---

## Screen 1 — Phase Picker ("Cone Slider")
File: `Cone Slider - Interactive Prototype.dc.html`

### Purpose
Lets the user select which of 5 standard project phases they're estimating at. The selection determines the guidance ratio (worst÷best heuristic) used by the range bar below it.

### The 5 phases (verbatim from PRD 6.1's "Agile Equivalent" column)
| # | Formal phase name | Agile equivalent | Low multiplier | High multiplier |
|---|---|---|---|---|
| 0 | Initial Concept | Product Vision | 0.25× | 4× |
| 1 | Approved Product Definition | Backlog w/ Epics | 0.5× | 2× |
| 2 | Requirements Complete | Refined Stories | 0.67× | 1.5× |
| 3 | UI Complete | Sprint Planning I | 0.8× | 1.25× |
| 4 | Detailed Design Complete | Sprint Planning II | 0.9× | 1.10× |

Guidance ratio shown to the user = `high / low` (e.g. Requirements Complete = 1.5/0.67 ≈ ×2.24).

### Layout
- Card: `background: var(--color-surface)`, `border: 1px solid var(--color-divider)`, `border-radius: var(--radius-lg)`, padding `40px 44px 20px`, max-width 640px.
- A horizontal draggable track (~230–320px tall depending on gap) containing:
  - **Fill**: an SVG polygon between the mirrored cone curves, filled with a horizontal linear gradient (`stop-opacity 0.16` → `0.62` of `var(--color-accent)`), stroked 1px `var(--color-accent-700)`.
  - **Cone curve**: a cubic-bezier path drawn twice — once above the axis, once mirrored below (`transform: scaleY(-1)`) — to form a symmetric "cone" widening away from the selected point. Steep initial drop (elbow at ~41% of width), flattening out.
  - **Axis**: a horizontal baseline + 5 evenly-spaced (0/25/50/75/100%) vertical tick marks, drawn brighter (`var(--color-neutral-300)`, opacity 0.5–0.7) so they read on top of the fill.
  - **Selection marker**: a 16×16px diamond (`rotate(45deg)`, `var(--color-accent-200)` fill, `var(--color-accent-900)` border, `box-shadow: 0 0 0 4px var(--color-surface)`) sitting on the axis at the selected phase's tick (0/25/50/75/100%).
  - **Connector line**: 1px vertical line, `var(--color-accent-700)`, from the ratio callout down to the diamond.
  - **Ratio callout**: floating chip above the diamond — bg `var(--color-accent-900)`, border `var(--color-accent-700)`, radius `var(--radius-md)`, showing `×{ratio}` (e.g. "×2.24") plus a mini range-bar (4px track, filled segment positioned log-scale between the phase's low/high multipliers, with `{low}×` / `{high}×` labels below it).
  - **Guide line**: a thin 1px vertical line (`var(--color-accent-400)`, opacity 0.4) running the full height of the fill at the selected x-position — dimmed and clipped to the fill's own bounds (not floating past it).
  - **Step dots**: 5 small circles (8px, `var(--color-neutral-500)`, brightening to `var(--color-accent-300)` on hover and `var(--color-accent-200)` when active) at each tick — clicking one jumps directly to that phase.
  - **Phase labels**: below the axis, 5 flex cells (`flex: 1 1 90px; min-width: 0`) with the formal phase name, highlighting the active one (`var(--color-accent-300)`, weight 600).
- **Nudge arrows**: two 28px circular buttons (phosphor `caret-left`/`caret-right` icons) pinned to the card's left/right edges, vertically centered on the diamond — invisible by default (`opacity: 0`), fade in on hovering the whole card (`opacity: 1`), and hide entirely (not just dim) at the first/last phase.

### Interaction / Behavior
- **Drag**: pointerdown on the track starts a drag; the diamond follows the pointer continuously (no transition) at the mouse's raw percentage position.
- **Snap on release**: on pointerup, the value snaps to the nearest of the 5 phase positions (`Math.round(pct/25)`, clamped 0–4) with a 220ms ease-out transition on `left`.
- **Click a step dot**: jumps directly to that phase with the same 220ms snap transition.
- **Nudge arrows**: step ±1 phase, disabled/hidden at the ends, same snap transition.
- All dependent values (ratio, mini-bar fill, callout text, active label) update immediately with the selection.

### Design tokens used
- Colors: `--color-surface`, `--color-divider`, `--color-bg`, `--color-accent` (+ ramps 200/300/400/700/900), `--color-neutral` (300/500).
- Radius: `--radius-lg`, `--radius-md`.
- Font: `--font-heading` (ratio callout, 700 weight), default body font elsewhere.
- Icons: Phosphor (`ph-caret-left`, `ph-caret-right`), loaded via `https://unpkg.com/@phosphor-icons/web@2.1.1/src/regular/style.css`.

---

## Screen 2 — Guidance-Aware Range Bar
File: `Range Bar Control - Final.dc.html` (see cards `9a` and `9b`)

### Purpose
Extends the app's existing `RangeBar` (best/most likely/90% confidence/worst) to show, for the phase selected above, whether the user's entered range is realistic — developers reliably estimate best case but tend to guess worst case too optimistically, so **the guidance range's left edge is always anchored to the user's own best-case value**, not to a separate absolute scale.

Guidance ceiling formula: `guidanceHigh = bestCase × (phase.high / phase.low)`.

### Two states, same component

**9a — worst case narrower than guidance** (the common case: developer under-estimated worst case)
- Track fills a **fixed 78%** of the available width, regardless of the true guidance ratio — this keeps the four real markers (best/most likely/90% confidence/worst) at a legible, constant scale no matter how extreme the ratio gets.
- Past the worst-case marker (at the 78% mark), a **compressed "ghost" segment** (diagonal hatch pattern, `repeating-linear-gradient(45deg, var(--color-neutral-700) 0 4px, transparent 4px 8px)`) fills the remaining 22% of the track, representing the compressed distance out to the guidance ceiling.
- A **break-gap mark**: a 6px vertical strip in the card's background color, positioned 3% right of the worst-case marker (i.e. NOT on top of it) — signals "the scale changes here" without a distracting diagonal-slash decoration.
- The guidance ceiling value is shown as a boxed accent callout at the top-right corner (same visual weight as the 90%-confidence callout).
- Labels below the track: best case (left, plain text), most likely (center, plain text, position-clamped to stay ≥14% away from both best and worst so it never collides with either), worst case (right, plain text).
- 90% confidence stays as a boxed accent callout above the track (unaffected by the below-track relabeling, since nothing else shares its row).

**9b — worst case already exceeds guidance** (developer's range already covers the heuristic)
- No compression needed: the track uses its **full 0–100% width** at full resolution, since the real worst-case value is beyond the guidance ceiling.
- The guidance ceiling appears as a plain 2px tick line (`var(--color-accent-400)`) sitting *inside* the track (wherever it actually falls, e.g. inside the "confident" segment), with its value labeled directly beneath the tick — not as an edge callout.
- No break-gap, no ghost segment, no warning.
- A calm confirmation note below the bar (icon `ph-check-circle`, `var(--color-accent-400)`): *"Your worst case ({max}d) already covers this phase's guidance ceiling of {ceiling}d."* — this replaces what would otherwise be a shortfall warning in the narrower case.

### Which state to render
Compute `guidanceHigh = bestCase × ratio`. If `worstCase < guidanceHigh` → render as 9a (compressed). If `worstCase >= guidanceHigh` → render as 9b (full width). This branch should be automatic based on the entered values, not a manual toggle.

### Segment coloring (shared with existing RangeBar — do not change)
- `best → most likely`: `var(--color-accent-800)` ("uncertain")
- `most likely → 90% confidence`: `var(--color-accent-600)` ("likely")
- `90% confidence → worst`: `var(--color-accent)` ("confident")
- Diamond markers (18×18px, `rotate(45deg)`, `var(--color-accent)` fill, `box-shadow: 0 0 0 3px var(--color-bg)`) at all four positions: best, most likely, 90% confidence, worst.

### Label collision handling (important — do not skip)
- **Most likely vs. best/worst**: if the "most likely" label's computed position would sit within 14% of either edge label, push it inward to maintain that minimum gap (see `posLikelyBelow` / `likelyLabelPct` in the reference JS).
- **Most likely vs. 90% confidence** (both boxed, above the track): if their positions are within `90px / 560px` (in %) of each other, push both apart symmetrically around their midpoint so the boxes never overlap.
- Reference implementation for both is in the `computeCompressed` / `computeFull` methods in the bundled file's script block — port this logic directly, it's already tuned.

### 90% confidence computation (existing app logic — verify against production)
The reference file approximates `ci90 = mostLikely + 0.5375 × (worst − mostLikely)`. **Confirm this matches the app's actual PERT/confidence-interval formula in `RangeBar.tsx` before shipping** — this was reverse-engineered for the mockup, not pulled from source.

### Design tokens used
Same token set as Screen 1, plus `var(--color-neutral-700/800)` for the ghost hatch and unfilled track background, `var(--radius-sm)` for callout corners.

---

## State Management
- **Phase picker**: single integer index (0–4) is the only state needed; everything else (ratio, curve shape, labels) derives from it. Drag introduces one transient float (`dragPct`) during pointer-move, discarded/snapped on release.
- **Range bar**: driven by 4 numeric inputs already in the app (`min`/best, `max`/worst, `expected`/most likely, and the newly-selected `phase`). No new persisted state beyond storing the selected phase per item (per the earlier product decision: **per-item**, **per-participant** — each participant's own phase selection affects only their own view).

## Assets
- Phosphor Icons (regular set) via CDN — `ph-caret-left`, `ph-caret-right`, `ph-check-circle`. Swap for the app's existing icon system if Phosphor isn't already a dependency.
- No raster images.

## Files in this bundle
- `Cone Slider - Interactive Prototype.dc.html` — Screen 1, phase picker (open directly in a browser to interact with it).
- `Range Bar Control - Final.dc.html` — Screen 2, both range-bar states side by side (cards `9a` and `9b`).

## Not yet in scope / open questions for engineering
- The formula for `ci90` should be verified against the app's real calculation, not assumed from this mockup.
- No decision has been made yet on whether "most likely exceeds guidance" gets any positive-confirmation copy elsewhere in the flow, or whether the calm note in 9b should be dismissible/persistent.

## Known implementation deviations
- **Phase Picker width**: the mockup's card has a fixed `max-width: 640px`. The shipped component stretches to fill its parent card's full width (matching its sibling inputs, ~940px in the app's layout) instead of staying capped — the cone-curve SVGs and axis scale up accordingly.
- **Ratio callout at the first/last phase**: not covered by the mockup. The callout is horizontally centered on the selected tick, which would overflow past the card border at Initial Concept (0%) or Detailed Design Complete (100%). The shipped version clamps the callout's position to stay within the card at either edge, while the diamond/guideline/connector stay on the exact tick position.
- **ci90 reaching or exceeding worst case**: not covered by the mockup (the reference `ci90` approximation can't produce this). The app's real PERT-based `ci90` can mathematically land at or past worst case when most likely sits close to worst for a narrow spread. Rather than clamping the displayed value, the shipped `RangeBar` hides the 90%-confidence marker/callout in that case and shows a warning explaining that most likely is too close to worst case for the entered spread.
