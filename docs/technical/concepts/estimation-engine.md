# Estimation Engine — Technical Concept

Implements the process and rules described in
[estimation-method](../../domain/concepts/estimation-method.md) (domain concept).

> Moved from `docs/technical/architecture.md` when that document became the arc42 architecture index.
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

interface AggregateValues { min: number; expected: number; max: number; ci90: number }
type AggregateResult = AggregateValues & { readonly [AggregateResultBrand]: true }

function createAggregateResult(values: AggregateValues): Result<AggregateResult>
function aggregateEstimates(estimates: Estimate[], strategy = DEFAULT_STRATEGY): AggregateResult
function computeCI90(expected: number, best: number, worst: number): number {
  return expected + 1.28 * ((worst - best) / 3)   // McConnell's formula, PRD §5
}
```

**`Estimate` is a self-validating value type, not a bare interface.** `best ≤ likely ≤ worst` is a domain invariant of what an Estimate *is* — not a UI-specific concern — so per hexagonal architecture's port/adapter separation, it's enforced once in the core rather than duplicated across every adapter that constructs one (the estimate form, incoming Trystero peer messages, a future CSV import). `Estimate` is only producible via `createEstimate(input): Result<Estimate, EstimateError>`, which is the single point where every `Estimate` rule is checked, each one a code of `EstimateError`:

```ts
interface RawEstimateInput { participantId: string; best: number; likely: number; worst: number }
type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E }

declare const EstimateBrand: unique symbol
type Estimate = RawEstimateInput & { readonly [EstimateBrand]: true }

type EstimateError =
  | { code: 'not-finite'; fields: EstimateField[] }       // NaN or ±Infinity
  | { code: 'too-large'; fields: EstimateField[] }        // above MAX_ESTIMATE_VALUE (1,000,000)
  | { code: 'non-positive'; fields: ['best'] }            // best <= 0
  | { code: 'best-above-likely'; fields: ['best', 'likely'] }
  | { code: 'likely-above-worst'; fields: ['likely', 'worst'] }
  | { code: 'no-participant' }                            // blank participantId

function createEstimate(input: RawEstimateInput): Result<Estimate, EstimateError>
function estimateErrorText(error: EstimateError): string  // one sentence per code
```

The brand is compile-time only — it adds no runtime property, so `Estimate` stays plain, JSON-transparent data for network transport and file-based session storage — but it does make constructing one any other way (e.g. a bare `{best, likely, worst}` object literal) a type error everywhere `Estimate` is expected. This only guards against *accidental* misuse within our own code, though: TypeScript types don't exist at runtime, so they can't protect against a malformed message from an untrusted Trystero peer. The network layer therefore calls `createEstimate()` on every incoming peer message before it touches state — via `parseWireEstimate()` in `adapters/network/wireParse.ts`, which also traps the throw path since peer input isn't guaranteed well-shaped. One shared validation function, not the ordering check re-implemented per adapter.

**Why `AggregateStrategy` is a per-field interface, not a single toggle:** this engine makes the aggregation logic itself configurable, and its philosophy is asymmetric on purpose — `min`/`max` for Best/Worst specifically to *preserve* outliers ("don't average away the outliers... worst case tends to get optimistically averaged down"), `median` for Likely as a robust center. A single `'min-max' | 'average'` switch couldn't express that; three independent knobs can. Currently this is only a code-level configurability point — neither the PRD nor [live-collaboration](../../domain/concepts/live-collaboration.md)'s Information model has a field for *which* strategy a session uses, so it's an engineering default for now, not a facilitator-facing setting (flagged below).

**Bias guards return structured signals, not copy.** PRD §5's guards are real estimation-engine functions; the exact warning text belongs in the screens layer so product/design can iterate on wording without touching tested logic:

```ts
interface GuardResult { fired: boolean; deviationPct?: number }
function checkSymmetricRange(best: number, likely: number, worst: number, tolerance = 0.15): GuardResult
function checkFalsePrecision(value: number, granularity: number): GuardResult
function checkOutlier(estimate: Estimate, allEstimates: Estimate[], thresholdPct = 0.4): GuardResult
function checkUncertaintyRange(best: number, worst: number, level: UncertaintyLevel): GuardResult
```

**`AggregateResult` is self-validating the same way.** `createAggregateResult()` (`domain/estimate/aggregateResult.ts`) is the only producer: it rejects a value that isn't finite, a minimum of 0 or less, a minimum above the maximum, an expected value outside the range, and a 90% value that isn't `computeCI90`'s for the range (within floating-point noise), each with a clause naming the rule. `aggregateEstimates()` builds its result through it and throws if a strategy produces a result that breaks a rule (possible with a mean of best cases above a median of likely ones; the default strategy never does). The session-file reader (`domain/sessionFile.ts`) checks only the shape of a stored result and hands the four numbers to the same factory, prefixing its clause with the item ("Item 1, "Login", has a minimum of 0 or less."). Tests build results through `aggregateOf()` in `domain/testFixtures.ts`.

**Errors are data; each caller chooses the words.** `domain/estimate/estimate.ts` also exports `validateEstimateValues` — the numeric half of `createEstimate`'s invariant, usable for a live form preview before a participant exists; `createEstimate` runs it after its `participantId` check. Like `createEstimate`, it rejects with an error that carries no text (every `EstimateError` code but `no-participant`, sketched above). `estimateErrorText` is the one place a code becomes a sentence, for logs, the network layer's rejections and use-case results; `features/estimate-round` (`lib/describeEstimateIssue.ts`) instead turns the code and fields into the actionable form messages (naming the numbers and what to change) and marks the offending inputs `aria-invalid` with `aria-describedby` pointing at the message. A problem first appears only after the entry has settled (~600 ms, `model/useSettledIssue.ts`) or a field loses focus, so typing through an intermediate value doesn't flash it; an entry that is already invalid when the form opens is shown at once, a showing problem updates in place, a resolved one clears at once, and the submit button is never delayed.

The PRD §5 uncertainty-range guard (`checkUncertaintyRange`) is implemented: a participant optionally selects a cone-of-uncertainty phase per item via the Phase Picker (`features/estimate-round/ui/PhasePicker.tsx`), local to their own view (guidance derived inside `features/estimate-round/model/useThreePointDraft.ts`, composed with the rest of the entry form by `ThreePointEstimateForm`), and the guard fires when their entered range is narrower than that phase's guidance ratio, anchored to Best Case.

**Tunable constants, not settled numbers:** the symmetric-range tolerance (15%) and outlier threshold (no range overlap, or `likely` deviates >40% of the others' spread) are the current values the domain concept and its specs state — named constants, expected to be retuned after real sessions rather than treated as final.
