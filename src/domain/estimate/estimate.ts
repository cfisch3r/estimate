/** A best / likely / worst triple — the three numbers of a three-point estimate,
 *  before any participant is attached to it or its ordering is validated. */
export interface EstimateValues {
  best: number
  likely: number
  worst: number
}

export interface RawEstimateInput extends EstimateValues {
  participantId: string
}

/** A factory's verdict: the value, or why it was refused. The error is a
 *  sentence unless the factory gives a structured one (see `EstimateError`). */
export type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E }

/** The outcome of a use case that produces no value, only success or a
 *  user-facing reason it was refused (submit, finalize). */
export type ActionResult = { ok: true } | { ok: false; error: string }

declare const EstimateBrand: unique symbol

/** Only producible via createEstimate() — the single point where the best <= likely
 *  <= worst invariant is enforced, regardless of which adapter is constructing one
 *  (a form, an incoming Trystero peer message, a CSV import). This is the "port"
 *  every adapter must pass through before the rest of /calc — the domain core — ever
 *  sees an Estimate, so aggregateEstimates() and the guards can trust their input
 *  completely rather than re-checking it.
 *
 *  The brand is compile-time only: it adds no runtime property, so an Estimate
 *  stays plain, JSON-transparent data for network transport and IndexedDB storage. */
export type Estimate = RawEstimateInput & { readonly [EstimateBrand]: true }

export type EstimateField = 'best' | 'likely' | 'worst'

/** A descending pair a full best / likely / worst triple can have: with all
 *  three values given, best above worst always means one of these two. */
type EstimateOrderViolation =
  | { code: 'best-above-likely'; fields: ['best', 'likely'] }
  | { code: 'likely-above-worst'; fields: ['likely', 'worst'] }

/** Why the values given so far are out of order, as data a UI can turn into an
 *  actionable message. `fields` names the inputs involved. Best above worst can
 *  only be told apart while the likely case is still missing. */
export type OrderViolation =
  EstimateOrderViolation | { code: 'best-above-worst'; fields: ['best', 'worst'] }

/** The largest value a best, likely or worst case may hold, in any unit. Far
 *  above any real estimate, and far enough below the largest double that
 *  aggregating such values (the 90% value adds to the maximum) stays finite —
 *  so no submission, however large, can make a final result break its rules. */
export const MAX_ESTIMATE_VALUE = 1_000_000

/** Why a full best / likely / worst triple was rejected: the rule broken, and
 *  the inputs that break it. */
export type EstimateValuesError =
  | { code: 'not-finite'; fields: EstimateField[] }
  | { code: 'too-large'; fields: EstimateField[] }
  | { code: 'non-positive'; fields: ['best'] }
  | EstimateOrderViolation

export type EstimateValuesResult =
  { ok: true } | { ok: false; error: EstimateValuesError }

/** Why `createEstimate()` refused an estimate. Carries no text: one sentence per
 *  rule comes from `estimateErrorText()`. */
export type EstimateError = EstimateValuesError | { code: 'no-participant' }

/** The descending pair among best / likely and likely / worst, for the values
 *  filled in so far (null = not yet typed). */
function findPairViolation(
  best: number | null,
  likely: number | null,
  worst: number | null,
): EstimateOrderViolation | null {
  if (best !== null && likely !== null && best > likely) {
    return { code: 'best-above-likely', fields: ['best', 'likely'] }
  }
  if (likely !== null && worst !== null && likely > worst) {
    return { code: 'likely-above-worst', fields: ['likely', 'worst'] }
  }
  return null
}

/** The first descending pair among the values filled in so far (null = not yet
 *  typed), so a violation can be flagged before the third value exists. Together
 *  with findPairViolation() this is the single home of the ordering rule:
 *  validateEstimateValues() uses the pair check, which is all a full triple needs. */
export function findOrderViolation(
  best: number | null,
  likely: number | null,
  worst: number | null,
): OrderViolation | null {
  const pair = findPairViolation(best, likely, worst)
  if (pair) return pair
  if (best !== null && worst !== null && best > worst) {
    return { code: 'best-above-worst', fields: ['best', 'worst'] }
  }
  return null
}

/** The numeric half of the invariant, usable before there is a participant to
 *  attribute the estimate to (e.g. live form preview). createEstimate() runs it
 *  after its participantId check, so the two can't drift. */
export function validateEstimateValues(
  best: number,
  likely: number,
  worst: number,
): EstimateValuesResult {
  const entries: [EstimateField, number][] = [
    ['best', best],
    ['likely', likely],
    ['worst', worst],
  ]
  const notFinite = entries.filter(([, value]) => !Number.isFinite(value))
  if (notFinite.length > 0) {
    return {
      ok: false,
      error: { code: 'not-finite', fields: notFinite.map(([field]) => field) },
    }
  }
  const tooLarge = entries.filter(([, value]) => value > MAX_ESTIMATE_VALUE)
  if (tooLarge.length > 0) {
    return {
      ok: false,
      error: { code: 'too-large', fields: tooLarge.map(([field]) => field) },
    }
  }
  // best is the smallest of the three once the ordering check below passes, so checking
  // it alone is enough to guarantee likely and worst are positive too.
  if (best <= 0) {
    return { ok: false, error: { code: 'non-positive', fields: ['best'] } }
  }
  const violation = findPairViolation(best, likely, worst)
  if (violation) return { ok: false, error: violation }
  return { ok: true }
}

export function createEstimate(input: RawEstimateInput): Result<Estimate, EstimateError> {
  const { participantId, best, likely, worst } = input

  if (participantId.trim().length === 0) {
    return { ok: false, error: { code: 'no-participant' } }
  }
  const values = validateEstimateValues(best, likely, worst)
  if (!values.ok) return values

  return { ok: true, value: input as Estimate }
}

/** One sentence per rule. A Record, not a switch, so a new code without a
 *  sentence doesn't compile. */
const ESTIMATE_ERROR_TEXT: Record<EstimateError['code'], string> = {
  'not-finite': 'best, likely, and worst must all be finite numbers',
  'too-large': `best, likely, and worst must all be at most ${MAX_ESTIMATE_VALUE}`,
  'non-positive': 'best, likely, and worst must all be greater than 0',
  'best-above-likely': 'best must be ≤ likely',
  'likely-above-worst': 'likely must be ≤ worst',
  'no-participant': 'participantId must not be empty',
}

/** The only place an estimate error becomes a sentence — for logs, thrown
 *  errors and use-case results. The estimate form builds its own message from
 *  the code and fields instead. */
export function estimateErrorText(error: EstimateError): string {
  return ESTIMATE_ERROR_TEXT[error.code]
}
