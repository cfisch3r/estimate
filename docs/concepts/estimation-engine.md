# Estimation Engine — Technical Concept

> Moved from `docs/architecture.md` when that document became the arc42 architecture index.
> The engine is the pure part of the domain layer (`src/domain/estimate`, formerly `/calc`);
> its place in the architecture is described in [architecture.md](../architecture.md), section 5.

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

**`Estimate` is a self-validating value type, not a bare interface.** `best ≤ likely ≤ worst` is a domain invariant of what an Estimate *is* — not a UI-specific concern — so per hexagonal architecture's port/adapter separation, it's enforced once in the core rather than duplicated across every adapter that constructs one (the estimate form in #7, incoming Trystero peer messages, a future CSV import). `Estimate` is only producible via `createEstimate(input): Result<Estimate, string>`, which is the single point where the ordering (and finiteness) check happens:

```ts
interface RawEstimateInput { participantId: string; best: number; likely: number; worst: number }
type Result<T> = { ok: true; value: T } | { ok: false; error: string }

declare const EstimateBrand: unique symbol
type Estimate = RawEstimateInput & { readonly [EstimateBrand]: true }

function createEstimate(input: RawEstimateInput): Result<Estimate>
```

The brand is compile-time only — it adds no runtime property, so `Estimate` stays plain, JSON-transparent data for network transport and file-based session storage — but it does make constructing one any other way (e.g. a bare `{best, likely, worst}` object literal) a type error everywhere `Estimate` is expected. This only guards against *accidental* misuse within our own code, though: TypeScript types don't exist at runtime, so they can't protect against a malformed message from an untrusted Trystero peer. The network layer therefore calls `createEstimate()` on every incoming peer message before it touches state — via `safeCreateEstimate()` in `adapters/network/actions.ts`, which also traps the throw path since peer input isn't guaranteed well-shaped. One shared validation function, not the ordering check re-implemented per adapter.

**Why `AggregateStrategy` is a per-field interface, not a single toggle:** PRD §5 requires the aggregation logic itself to be configurable, but its philosophy is asymmetric on purpose — `min`/`max` for Best/Worst specifically to *preserve* outliers ("don't average away the outliers... worst case tends to get optimistically averaged down"), `median` for Likely as a robust center. A single `'min-max' | 'average'` switch couldn't express that; three independent knobs can. Currently this is only a code-level configurability point — the PRD data model has no field for *which* strategy a session uses, so it's an engineering default for now, not a facilitator-facing setting (flagged below).

**Bias guards return structured signals, not copy.** PRD §6's guards are real estimation-engine functions; the exact warning text belongs in the screens layer so product/design can iterate on wording without touching tested logic:

```ts
interface GuardResult { fired: boolean; deviationPct?: number }
function checkSymmetricRange(best: number, likely: number, worst: number, tolerance = 0.15): GuardResult
function checkFalsePrecision(value: number, granularity: number): GuardResult
function checkOutlier(estimate: Estimate, allEstimates: Estimate[], thresholdPct = 0.4): GuardResult
function checkUncertaintyRange(best: number, worst: number, level: UncertaintyLevel): GuardResult
```

`domain/estimate/estimate.ts` also exports `validateEstimateValues` — the numeric half of `createEstimate`'s invariant, usable for a live form preview before a participant exists; `createEstimate` runs it after its `participantId` check. It returns a `code` and the affected `fields` alongside the error text, and `features/estimate-round` (`lib/describeEstimateIssue.ts`) turns those into the actionable form messages (naming the numbers and what to change) and marks the offending inputs `aria-invalid` with `aria-describedby` pointing at the message. A problem first appears only after the entry has settled (~600 ms, `model/useSettledIssue.ts`) or a field loses focus, so typing through an intermediate value doesn't flash it; an entry that is already invalid when the form opens is shown at once, a showing problem updates in place, a resolved one clears at once, and the submit button is never delayed.

The PRD §6.1 uncertainty-range guard (`checkUncertaintyRange`) is implemented: a participant optionally selects a cone-of-uncertainty phase per item via the Phase Picker (`features/estimate-round/ui/PhasePicker.tsx`), local to their own view (guidance derived inside `features/estimate-round/model/useThreePointDraft.ts`, composed with the rest of the entry form by `ThreePointEstimateForm`), and the guard fires when their entered range is narrower than that phase's guidance ratio, anchored to Best Case.

**Tunable constants, not settled numbers:** the symmetric-range tolerance (proposed 15%) and outlier threshold (proposed: no range overlap, or `likely` deviates >40% of group spread) are UX-tuning parameters PRD leaves vague ("within a tolerance," "far from the group median") — ship as named constants, expect to retune after real sessions rather than treating these as final.
