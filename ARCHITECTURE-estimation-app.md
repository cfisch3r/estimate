# EstiMate — Technical Architecture

**Status:** Accepted
**Based on:** PRD-estimation-app.md, ADR-001-live-collaboration-architecture.md, design_handoff_estimate_app/

## Context

EstiMate is a greenfield project — only planning docs existed before this document (`PRD-estimation-app.md`, `ADR-001-live-collaboration-architecture.md`, and a high-fidelity clickable HTML prototype in `design_handoff_estimate_app/`). No code has been written yet. ADR-001 already settles the hardest architectural call: live collaboration is peer-to-peer WebRTC (STUN + serverless signaling), with Manual Entry as a first-class, equally-supported second mode — no backend operated by the product for live session communication.

What this document covers is everything ADR-001 doesn't: the framework, how P2P signaling concretely works, how session history persists (a real point of tension with the PRD's "no operated server" phrasing, since ADR-001's constraint is scoped to live sync, not storage), styling/design-system approach, hosting, and module structure.

## Confirmed decisions

- **Persistence:** local-first only. Session/history data lives in the facilitator's browser (IndexedDB), with CSV export and a shareable read-only link for reports. No cross-device "team" sync in MVP — a session lives on the device that created it. This keeps the app at genuinely zero operated infrastructure, matching PRD §2's top-level goal, not just ADR-001's narrower live-sync text.
- **Auth:** none. Open links only — anyone with a session link can view/edit it. Consistent with local-first persistence; revisit if/when cross-device history is ever built.
- **Facilitator disconnect mid-session:** accepted as an MVP gap. If the facilitator's peer drops, the session stalls for remaining participants; no auto-reassignment or election. Document as a known limitation.
- **Mode switching mid-session:** out of scope for MVP. Mode is fixed at session creation (per PRD §4.1 flow). If P2P fails mid-session, the facilitator starts a fresh Manual Entry session rather than converting in place.
- **Estimation unit:** configurable per session (facilitator picks hours/days/weeks at session creation), not fixed and not per-item. Resolves an inconsistency between PRD §5's worked example (days) and the prototype's hardcoded "weeks" — neither was a real decision. Requires a `unit` field on `Session` (not currently in PRD §8's data model sketch) and a small dropdown on the Create Session screen. The false-precision guard's rounding granularity derives from this field via a lookup (e.g. `{hours: 1, days: 0.5, weeks: 0.5}`, exact values tunable).
- **Unit selector control:** a native `<select class="input">` on Create Session — reuses Nocturne's existing generic input styling, no new component or design mock needed.
- **Symmetric-range / false-precision nudge styling:** ship using the same plain `.card-meta` muted-caption treatment already used for the job-stakes hint (no distinct "nudge" component exists in Nocturne today). Explicitly logged as a fast-follow design polish item, not blocking MVP build — pragmatic since the guard thresholds themselves are still untuned and likely to change after real usage.
- **Design system: port Nocturne as-is, no Tailwind migration.** Nocturne's `styles.css` (CSS custom properties + global component classes) is the single canonical source of truth for tokens and components, per its own bundled readme. Considered and rejected migrating it to Tailwind: the values are hand-tuned/procedurally generated (non-round spacing scale, OKLCH color ramps) and re-expressing them in a second config risks fidelity drift plus an ongoing sync burden against `styles.css`, for a benefit (utility-class layout ergonomics) that doesn't clearly apply here since there's no existing Tailwind codebase to align with. Layout glue uses scoped CSS referencing Nocturne's existing `--space-*` variables instead.

## Recommended stack

**Frontend: React 19 + TypeScript + Vite, no meta-framework.**
Static SPA — no server-side rendering needed, no routes that require backend data at request time. Phosphor's React icon package matches the prototype directly. Nocturne's design system is plain CSS custom properties + global classes (`.btn`, `.card`, `.field`, `.tag`, `.radio`), so it ports as-is via `className` — no CSS-in-JS conversion needed. React + hooks handles the prototype's interaction surface (drag-reorder, inline edit forms, async peer events) without extra tooling. (Originally scoped as "React 18" during architecture discussion; the M0 scaffold used `create-vite`'s current default, React 19 — a version bump, not a design change, so adopted rather than pinned back.)

**Tooling: oxlint for linting, not ESLint.** `create-vite`'s current default template ships oxlint (a faster, Rust-based linter) rather than ESLint + typescript-eslint. Functionally equivalent for this project's needs — TypeScript/React rule coverage, no custom rule authoring required — so adopted as scaffolded rather than swapped for the originally-assumed ESLint setup. Prettier still handles formatting (oxlint doesn't format).

**State management: a single reducer/store (Zustand)** rather than scattered `useState`, since WebRTC peer events arrive asynchronously and out of order — the network and persistence layers act as adapters that dispatch into the same store, so Mode A (live) and Mode B (manual) differ only in which adapter is active, not in UI logic.

**Hosting: static hosting** (Vercel/Netlify/Cloudflare Pages/GitHub Pages). No backend to provision or pay for — STUN servers and the P2P signaling network (below) are external services we don't operate.

## P2P live-sync layer (Mode A)

- **Room identity:** a random session ID (nanoid) generated at session creation, encoded directly in the shareable join link (`/join/<sessionId>`). Used as the Trystero `roomId`, with a fixed `appId` namespacing EstiMate's rooms.
- **Signaling strategy:** Trystero's **Nostr strategy** (`trystero/nostr`) as the default — this is the library's own default and top recommendation, backed by hundreds of independent public relays (most redundancy of the decentralized options), no account/config required, matches ADR-001's "no server we operate." Library's own robustness ranking for the decentralized strategies: Nostr → MQTT → BitTorrent → IPFS. Supabase/Firebase strategies exist but require configuring your own project (not zero-setup); a self-hosted WebSocket relay strategy also exists as an explicit escape hatch if the public networks prove unreliable, mirroring ADR-001's bring-your-own-TURN framing. Verified against current Trystero docs (trystero.dev, github.com/dmotz/trystero).
- **Room privacy:** `roomId` = the session ID embedded in the shareable join link — this is the invite mechanism. Consider passing Trystero's optional `password` (AES-GCM encrypts the signaling handshake) since without it the roomId is visible as metadata on the public signaling medium; a random nanoid roomId is already hard to guess, but a password closes the gap cheaply.
- **Data sync model: event broadcast, not CRDT.** Each peer only broadcasts its own submissions (`room.makeAction()`); every peer independently maintains the same append-only list of received estimates and computes min/median/max locally. This works because the PRD's aggregation (min of Best, max of Worst, median of Likely) is order-independent and idempotent — no conflict resolution needed, and Mode A/B can share one calculation engine.
- **Known gap to handle explicitly:** Trystero doesn't replay history to late joiners. On `onPeerJoin`, an existing peer must push a full state snapshot (current item, submissions so far, finalized items) to the newcomer.

## Module structure

```
/src
  /design       — ported Nocturne tokens.css + component CSS (framework-agnostic)
  /components   — Button, Card, Field, RadioTile, Tag — thin wrappers over Nocturne classes
  /screens      — one per PRD §7 screen (Create, Join, Session View, Estimate, Reveal, Summary, History)
  /calc         — pure functions: aggregateEstimates(), computeCI90() (McConnell's formula, PRD §5),
                  bias guards (symmetric-range, false-precision, outlier — PRD §6). Framework-free,
                  unit-testable, identical between Mode A and Mode B.
  /network      — Trystero wrapper: room join/create, typed actions (submitEstimate, syncState,
                  reveal), connection-state hooks, late-joiner snapshot handling
  /state        — Zustand store; network and persistence are adapters dispatching into it
  /persistence  — IndexedDB adapter, CSV export, shareable-report-link encode/decode
```

The `/calc` layer's isolation as pure, framework-free functions is the single most load-bearing structural decision — PRD §4.2 and ADR-001 both require identical calculation/bias-guard behavior across both modes, and this makes it trivially unit-testable against the PRD §5–6 formulas independent of UI or networking.

## `/calc` module — detailed design

**One aggregation function serves both modes.** `aggregateEstimates()` takes an array of `{best, likely, worst}` estimates and a strategy, and returns the group range. Fed a Live session's N participant submissions or a Manual Entry session's single facilitator-entered set, it's the same call — a single-element array degenerates correctly (min/median/max of one value = that value), so Mode B isn't a special case, it's a consequence of the design (satisfies PRD §4.2 / ADR-001's shared-engine requirement).

```ts
interface Estimate { participantId: string; best: number; likely: number; worst: number }

interface AggregateStrategy {
  best: 'min' | 'median' | 'mean'
  likely: 'median' | 'mean'
  worst: 'max' | 'median' | 'mean'
}
const DEFAULT_STRATEGY: AggregateStrategy = { best: 'min', likely: 'median', worst: 'max' }

interface AggregateResult { min: number; expected: number; max: number; ci90: number }

function aggregateEstimates(estimates: Estimate[], strategy = DEFAULT_STRATEGY): AggregateResult
function computeCI90(expected: number, best: number, worst: number): number {
  return expected + 1.28 * ((worst - best) / 3)   // McConnell's formula, PRD §5
}
```

**Why `AggregateStrategy` is a per-field interface, not a single toggle:** PRD §5 requires the aggregation logic itself to be configurable, but its philosophy is asymmetric on purpose — `min`/`max` for Best/Worst specifically to *preserve* outliers ("don't average away the outliers... worst case tends to get optimistically averaged down"), `median` for Likely as a robust center. A single `'min-max' | 'average'` switch couldn't express that; three independent knobs can. Currently this is only a code-level configurability point — the PRD data model has no field for *which* strategy a session uses, so it's an engineering default for now, not a facilitator-facing setting (flagged below).

**Bias guards return structured signals, not copy.** Three of PRD §6's four guards are real `/calc` functions; the exact warning text belongs in the screens layer so product/design can iterate on wording without touching tested logic:

```ts
interface GuardResult { fired: boolean; deviationPct?: number }
function checkSymmetricRange(best: number, likely: number, worst: number, tolerance = 0.15): GuardResult
function checkFalsePrecision(value: number, granularity: number): GuardResult
function checkOutlier(estimate: Estimate, allEstimates: Estimate[], thresholdPct = 0.4): GuardResult
```

The fourth guard, **"would you quit your job?"**, is not a computed guard at all — it's static helper text always shown next to the Worst Case field, lives in the screens layer, not `/calc`.

**Tunable constants, not settled numbers:** the symmetric-range tolerance (proposed 15%) and outlier threshold (proposed: no range overlap, or `likely` deviates >40% of group spread) are UX-tuning parameters PRD leaves vague ("within a tolerance," "far from the group median") — ship as named constants, expect to retune after real sessions rather than treating these as final.

## Screens — gaps vs. the prototype

The clickable prototype predates the `/calc` module and unit decisions above, so it doesn't show where bias-guard output or unit selection actually render. Checked against Nocturne's stylesheet directly (`_ds/nocturne-.../styles.css`) rather than assumed:

**Already covered by the prototype, no gap:**
- "Would you quit your job?" — already marked up as `<div class="card-meta">` under the Worst Case field; static copy, no computation, nothing to add.
- Outlier flag at Reveal — the warning icon on an outlier's row already exists in the design; it just needs to switch from hardcoded/simulated to driven by `checkOutlier()`'s real output.
- Unit-aware labels (Participant Estimate View, Manual Entry fields, Reveal bars, Summary rows currently hardcode "weeks") — mechanical copy interpolation of `session.unit`, not a new visual pattern.

**Genuine gaps, resolved for MVP:**
- Symmetric-range and false-precision nudges have no distinct visual pattern in Nocturne (only plain `.card-meta` caption styling exists, same as the job-stakes hint). **Decision: ship with the plain caption treatment, log a fast-follow design task** for a more distinct "live nudge" treatment rather than blocking MVP on a design pass.
- The unit selector is a genuinely new form control (Create Session has none today). **Decision: native `<select class="input">`**, reusing Nocturne's generic input styling — no new component or design mock required.

## Open items still worth flagging (not blocking, but real)

- "No accounts / open links" means anyone with a link can edit a session — acceptable for MVP given local-first + no cross-device stakes, but worth a sentence in the report/UI so facilitators understand link = access.
- Local-first persistence means session history genuinely does not survive a cleared browser or a different device — this should be stated plainly in the product UI (e.g., on the History screen), not just assumed understood.
- Trystero has no built-in room-size or message-size limits documented, but the mesh topology (direct peer connections, no SFU) means the library itself advises keeping groups small — a non-issue for typical estimation session sizes, but worth remembering if group sessions ever grow large.
- `AggregateStrategy` is only an engineering-level default for MVP (min/median/max, not facilitator-configurable) — PRD §5 calls for it to be "configurable" but neither the data model nor the prototype exposes a UI for it. Revisit if teams actually want to change aggregation policy per session, since that needs a schema field + UI, not just the code-level flexibility already designed in.
- `onPeerJoin`/`onPeerLeave` fire on connect/disconnect, but Trystero does not replay history to a newcomer — the late-joiner state snapshot (above) is entirely our responsibility to implement, not something the library helps with.

## Suggested next step

This document is the architecture proposal, agreed with the product owner. A natural follow-up is scaffolding the project (Vite + React + TS, porting Nocturne tokens, wiring the `/calc` module with unit tests for the PRD §5 formulas first, since that's the one piece with an unambiguous spec) — a separate implementation plan when ready to build.
