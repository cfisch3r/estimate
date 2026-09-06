# EstiMate — Technical Architecture

**Status:** Accepted
**Based on:** [prd.md](prd.md), [adr/001-live-collaboration-architecture.md](adr/001-live-collaboration-architecture.md), design_handoff_estimate_app/

## Context

This document was written as the architecture proposal before implementation began; it now
also serves as the as-built reference and is kept in step with the code. Its starting point
is [adr/001-live-collaboration-architecture.md](adr/001-live-collaboration-architecture.md),
the [PRD](prd.md), and a high-fidelity clickable HTML prototype in
`design_handoff_estimate_app/`. ADR-001 settles the hardest architectural call: live
collaboration is peer-to-peer WebRTC (STUN + serverless signaling), with Manual mode as a
first-class, equally-supported second mode — no backend operated by the product for live
session communication.

What this document covers is everything ADR-001 doesn't: the framework, how P2P signaling
concretely works, how session history persists (a real point of tension with the PRD's
"no operated server" phrasing, since ADR-001's constraint is scoped to live sync, not
storage), styling/design-system approach, hosting, and module structure.

**As-built status.** The M0 scaffold, the `/calc` engine, the Zustand store, the Mode B
(Manual) screens, the Trystero P2P network layer, and the Join Session screen have all
shipped (issues #1–#6). For the concrete as-built detail of the Live-mode layer — the
`src/network/` component breakdown, the join sequence, the connection state machine, and
the store fields it added — see [concepts/collaboration-mode.md](concepts/collaboration-mode.md);
this document keeps the decisions and rationale, that one tracks the implementation. Still
open: the Participant Estimate View (#7), the Reveal View (#8), connection-fallback UX (#9),
and real persistence (`src/persistence/` is still a placeholder — session data is in-memory
only).

## Confirmed decisions

- **Persistence:** local-first only. Session/history data lives in the facilitator's browser (IndexedDB), with CSV export and a shareable read-only link for reports. No cross-device "team" sync in MVP — a session lives on the device that created it. This keeps the app at genuinely zero operated infrastructure, matching PRD §2's top-level goal, not just ADR-001's narrower live-sync text.
- **Auth:** none. Open links only — anyone with a session link can view/edit it. Consistent with local-first persistence; revisit if/when cross-device history is ever built.
- **Facilitator disconnect mid-session:** accepted as an MVP gap. If the facilitator's peer drops, the session stalls for remaining participants; no auto-reassignment or election. Document as a known limitation.
- **Mode switching mid-session:** out of scope for MVP. Mode is fixed at session creation (per PRD §4.1 flow). If P2P fails mid-session, the facilitator starts a fresh Manual-mode session rather than converting in place.
- **Estimation unit:** configurable per session (facilitator picks hours/days/weeks at session creation), not fixed and not per-item. Resolves an inconsistency between PRD §5's worked example (days) and the prototype's hardcoded "weeks" — neither was a real decision. Requires a `unit` field on `Session` (not currently in PRD §8's data model sketch) and a small dropdown on the Create Session screen. The false-precision guard's rounding granularity derives from this field via a lookup (e.g. `{hours: 1, days: 0.5, weeks: 0.5}`, exact values tunable).
- **Unit selector control:** a native `<select class="input">` on Create Session — reuses Nocturne's existing generic input styling, no new component or design mock needed.
- **Symmetric-range / false-precision nudge styling:** ship using the same plain `.card-meta` muted-caption treatment already used for the job-stakes hint (no distinct "nudge" component exists in Nocturne today). Explicitly logged as a fast-follow design polish item, not blocking MVP build — pragmatic since the guard thresholds themselves are still untuned and likely to change after real usage.
- **Design system: port Nocturne as-is, no Tailwind migration.** Nocturne's `styles.css` (CSS custom properties + global component classes) is the single canonical source of truth for tokens and components, per its own bundled readme. Considered and rejected migrating it to Tailwind: the values are hand-tuned/procedurally generated (non-round spacing scale, OKLCH color ramps) and re-expressing them in a second config risks fidelity drift plus an ongoing sync burden against `styles.css`, for a benefit (utility-class layout ergonomics) that doesn't clearly apply here since there's no existing Tailwind codebase to align with. Layout glue uses scoped CSS referencing Nocturne's existing `--space-*` variables instead.

## Recommended stack

**Frontend: React 19 + TypeScript + Vite, no meta-framework.**
Static SPA — no server-side rendering needed, no routes that require backend data at request time. Phosphor's React icon package matches the prototype directly. Nocturne's design system is plain CSS custom properties + global classes (`.btn`, `.card`, `.field`, `.tag`, `.radio`), so it ports as-is via `className` — no CSS-in-JS conversion needed. React + hooks handles the prototype's interaction surface (drag-reorder, inline edit forms, async peer events) without extra tooling. (The M0 scaffold took `create-vite`'s current default, React 19, rather than the React 18 assumed in early discussion — a version bump, not a design change.)

**Tooling: oxlint for linting, not ESLint.** `create-vite`'s current default template ships oxlint (a faster, Rust-based linter) rather than ESLint + typescript-eslint. Functionally equivalent for this project's needs — TypeScript/React rule coverage, no custom rule authoring required — so adopted as scaffolded rather than swapped for the originally-assumed ESLint setup. Prettier still handles formatting (oxlint doesn't format).

**State management: a single reducer/store (Zustand)** rather than scattered `useState`, since WebRTC peer events arrive asynchronously and out of order — the network and persistence layers act as adapters that dispatch into the same store, so Mode A (live) and Mode B (manual) differ only in which adapter is active, not in UI logic.

**Hosting: static hosting** (Vercel/Netlify/Cloudflare Pages/GitHub Pages). No backend to provision or pay for — STUN servers and the P2P signaling network (below) are external services we don't operate.

## P2P live-sync layer (Mode A)

- **Room identity:** `generateSessionCode()` (`src/network/sessionCode.ts`) produces a 6-char Crockford-base32 code at session creation (crypto RNG, ambiguous glyphs removed) — short enough to read aloud or paste into chat. It is the Trystero `roomId`, with a fixed `appId` (`estimate-app-v1`) namespacing EstiMate's rooms. *(The proposal assumed a nanoid embedded in a `/join/<id>` deep link; the as-built code ships the human-shareable code with no deep-link route — see the concept doc's "Known MVP gaps".)*
- **Signaling strategy:** Trystero's **Nostr strategy** (`trystero/nostr`) as the default — this is the library's own default and top recommendation, backed by hundreds of independent public relays (most redundancy of the decentralized options), no account/config required, matches ADR-001's "no server we operate." Library's own robustness ranking for the decentralized strategies: Nostr → MQTT → BitTorrent → IPFS. Supabase/Firebase strategies exist but require configuring your own project (not zero-setup); a self-hosted WebSocket relay strategy also exists as an explicit escape hatch if the public networks prove unreliable, mirroring ADR-001's bring-your-own-TURN framing. Verified against current Trystero docs (trystero.dev, github.com/dmotz/trystero).
- **Room privacy:** `roomId` = the shared session code — this is the invite mechanism. `joinSession()` accepts an optional `password` (Trystero AES-GCM encrypts the signaling handshake); without it the roomId is visible as metadata on the public signaling medium. The 6-char code is already hard to guess, but a password closes the gap cheaply if a session warrants it.
- **Data sync model: event broadcast, not CRDT.** Each peer only broadcasts its own submissions (`room.makeAction()`); every peer independently maintains the same append-only list of received estimates and computes min/median/max locally. This works because the PRD's aggregation (min of Best, max of Worst, median of Likely) is order-independent and idempotent — no conflict resolution needed, and Mode A/B can share one calculation engine.
- **Known gap to handle explicitly:** Trystero doesn't replay history to late joiners. On `onPeerJoin`, an existing peer must push a full state snapshot (current item, submissions so far, finalized items) to the newcomer. The wire action for this (`syncState`, carrying a `SessionSnapshot`) exists in `src/network/actions.ts`; broadcasting and applying it on join is wired up in #7.

## Module structure

```
/src
  /design       — ported Nocturne tokens.css + component CSS (framework-agnostic)
  /components   — Button, Card, Field, RadioTile, Tag — thin wrappers over Nocturne classes
  /screens      — one per PRD §7 screen (Create, Join, Session View, Participant Estimate
                  View, Reveal View, Summary, History). Built so far: Create, Session View,
                  Summary, History, Join. Participant Estimate View is a #6 placeholder
                  (real form in #7); Reveal View and its `reveal` ScreenId land in #8.
  /calc         — pure functions: aggregateEstimates(), computeCI90() (McConnell's formula, PRD §5),
                  bias guards (symmetric-range, false-precision, outlier — PRD §6). Framework-free,
                  unit-testable, identical between Mode A and Mode B.
  /network      — Trystero wrapper: room join/create, typed actions (submitEstimate, syncState,
                  reveal), connection-state hooks, late-joiner snapshot handling
  /state        — Zustand store; network and persistence are adapters dispatching into it
  /persistence  — IndexedDB adapter, CSV export, shareable-report-link encode/decode
```

The `/calc` layer's isolation as pure, framework-free functions is the single most load-bearing structural decision — PRD §4.2 and ADR-001 both require identical calculation/bias-guard behavior across both modes, and this makes it trivially unit-testable against the PRD §5–6 formulas independent of UI or networking.

**Testing note (ADR-002):** implementing `/network` or `/persistence` for real is the trigger to add Playwright — that's when browser-specific behavior (real reload/persistence, real P2P connection handling) first exists to justify an e2e layer. Scope it to a handful of golden-path smoke tests; keep edge cases in `/calc`/`/state`/component tests.

## `/calc` module — detailed design

**One aggregation function serves both modes.** `aggregateEstimates()` takes an array of `{best, likely, worst}` estimates and a strategy, and returns the group range. Fed a Live-mode session's N participant submissions or a Manual-mode session's single facilitator-entered set, it's the same call — a single-element array degenerates correctly (min/median/max of one value = that value), so Mode B isn't a special case, it's a consequence of the design (satisfies PRD §4.2 / ADR-001's shared-engine requirement).

```ts
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

**`Estimate` is a self-validating value type, not a bare interface.** `best ≤ likely ≤ worst` is a domain invariant of what an Estimate *is* — not a UI-specific concern — so per hexagonal architecture's port/adapter separation, it's enforced once in the core rather than duplicated across every adapter that constructs one (the M3 form, M5's incoming Trystero messages, a future CSV import). `Estimate` is only producible via `createEstimate(input): Result<Estimate, string>`, which is the single point where the ordering (and finiteness) check happens:

```ts
interface RawEstimateInput { participantId: string; best: number; likely: number; worst: number }
type Result<T> = { ok: true; value: T } | { ok: false; error: string }

declare const EstimateBrand: unique symbol
type Estimate = RawEstimateInput & { readonly [EstimateBrand]: true }

function createEstimate(input: RawEstimateInput): Result<Estimate>
```

The brand is compile-time only — it adds no runtime property, so `Estimate` stays plain, JSON-transparent data for network transport and IndexedDB storage — but it does make constructing one any other way (e.g. a bare `{best, likely, worst}` object literal) a type error everywhere `Estimate` is expected. This only guards against *accidental* misuse within our own code, though: TypeScript types don't exist at runtime, so they can't protect against a malformed message from an untrusted Trystero peer. M5 still has to call `createEstimate()` on every incoming peer message before it touches state — the difference is it's now calling one shared validation function instead of re-implementing the ordering check per adapter.

**Why `AggregateStrategy` is a per-field interface, not a single toggle:** PRD §5 requires the aggregation logic itself to be configurable, but its philosophy is asymmetric on purpose — `min`/`max` for Best/Worst specifically to *preserve* outliers ("don't average away the outliers... worst case tends to get optimistically averaged down"), `median` for Likely as a robust center. A single `'min-max' | 'average'` switch couldn't express that; three independent knobs can. Currently this is only a code-level configurability point — the PRD data model has no field for *which* strategy a session uses, so it's an engineering default for now, not a facilitator-facing setting (flagged below).

**Bias guards return structured signals, not copy.** PRD §6's guards are real `/calc` functions; the exact warning text belongs in the screens layer so product/design can iterate on wording without touching tested logic:

```ts
interface GuardResult { fired: boolean; deviationPct?: number }
function checkSymmetricRange(best: number, likely: number, worst: number, tolerance = 0.15): GuardResult
function checkFalsePrecision(value: number, granularity: number): GuardResult
function checkOutlier(estimate: Estimate, allEstimates: Estimate[], thresholdPct = 0.4): GuardResult
```

A fourth guard, the PRD §6.1 uncertainty-range check, is planned (see Post-MVP Phase 5 milestone) but not yet implemented.

**Tunable constants, not settled numbers:** the symmetric-range tolerance (proposed 15%) and outlier threshold (proposed: no range overlap, or `likely` deviates >40% of group spread) are UX-tuning parameters PRD leaves vague ("within a tolerance," "far from the group median") — ship as named constants, expect to retune after real sessions rather than treating these as final.

## Screens — gaps vs. the prototype

The clickable prototype predates the `/calc` module and unit decisions above, so it doesn't show where bias-guard output or unit selection actually render. Checked against Nocturne's stylesheet directly (`_ds/nocturne-.../styles.css`) rather than assumed:

**Already covered by the prototype, no gap:**
- Outlier flag at Reveal — the warning icon on an outlier's row already exists in the design; it just needs to switch from hardcoded/simulated to driven by `checkOutlier()`'s real output.
- Unit-aware labels (Participant Estimate View, Session View fields in Manual mode, Reveal bars, Summary rows currently hardcode "weeks") — mechanical copy interpolation of `session.unit`, not a new visual pattern.

**Genuine gaps, resolved for MVP:**
- Symmetric-range and false-precision nudges have no distinct visual pattern in Nocturne (only plain `.card-meta` caption styling exists). **Decision: ship with the plain caption treatment, log a fast-follow design task** for a more distinct "live nudge" treatment rather than blocking MVP on a design pass.
- The unit selector is a genuinely new form control (Create Session has none today). **Decision: native `<select class="input">`**, reusing Nocturne's generic input styling — no new component or design mock required.

## Open items still worth flagging (not blocking, but real)

- "No accounts / open links" means anyone with a link can edit a session — acceptable for MVP given local-first + no cross-device stakes, but worth a sentence in the report/UI so facilitators understand link = access.
- Local-first persistence means session history genuinely does not survive a cleared browser or a different device — this should be stated plainly in the product UI (e.g., on the History screen), not just assumed understood.
- Trystero has no built-in room-size or message-size limits documented, but the mesh topology (direct peer connections, no SFU) means the library itself advises keeping groups small — a non-issue for typical estimation session sizes, but worth remembering if group sessions ever grow large.
- `AggregateStrategy` is only an engineering-level default for MVP (min/median/max, not facilitator-configurable) — PRD §5 calls for it to be "configurable" but neither the data model nor the prototype exposes a UI for it. Revisit if teams actually want to change aggregation policy per session, since that needs a schema field + UI, not just the code-level flexibility already designed in.
- `onPeerJoin`/`onPeerLeave` fire on connect/disconnect, but Trystero does not replay history to a newcomer — the late-joiner state snapshot (above) is entirely our responsibility to implement, not something the library helps with.
- **Markdown rendering is not implemented.** Item descriptions and the per-item Notes field are both labeled "Markdown supported" in the UI (M3), but the values are stored and displayed as raw text — no parser/renderer is wired up anywhere. Found during the M3 screen review (2026-08-21) when a description containing `*`/`##`/`>` syntax rendered literally instead of formatted. Needs a markdown-to-safe-HTML renderer (e.g. `marked` + `DOMPurify`, or a React-native option like `react-markdown`) wired into `CardBody` (item description) and wherever Notes is displayed read-only. Not started; flagging so the "Markdown supported" copy doesn't ship as a false promise.

## Build status &amp; what's next

The proposal above has been built out through issue #6: Vite + React 19 + TS scaffold,
Nocturne ported as-is, the `/calc` engine (unit-tested against the PRD §5–6 formulas), the
Zustand store, the Mode B (Manual) screens, the Trystero P2P network layer, and the Join
Session screen.

Remaining MVP work, tracked on the EstiMate Roadmap board:

- **#7** — Participant Estimate View: the real Best/Likely/Worst form, plus wiring
  `NetworkProvider` to dispatch `onEstimate` / `onSyncState` / `onReveal` into the store and
  adding the `submissions` / round state the store doesn't have yet.
- **#8** — Reveal View: per-participant range table, group aggregate + CI90, `checkOutlier()`
  driving the outlier flag, the `reveal` ScreenId, and `revealedItemIds` state.
- **#9** — connection-fallback UX for peers that can't establish a direct connection.
- **Persistence** — `src/persistence/` (IndexedDB, CSV export, shareable report link) is
  still a placeholder.
- **Post-MVP Phase 5** — the PRD §6.1 cone-of-uncertainty guard.
