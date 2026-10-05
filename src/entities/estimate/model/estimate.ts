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

export type Result<T> = { ok: true; value: T } | { ok: false; error: string }

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

/** Why a best / likely / worst triple was rejected, as data a UI can turn into an
 *  actionable message. `fields` names the inputs involved. */
export type OrderViolation =
  | { code: 'best-above-likely'; fields: ['best', 'likely'] }
  | { code: 'likely-above-worst'; fields: ['likely', 'worst'] }
  | { code: 'best-above-worst'; fields: ['best', 'worst'] }

export type EstimateValuesError =
  | { code: 'not-finite'; fields: EstimateField[] }
  | { code: 'non-positive'; fields: ['best'] }
  | OrderViolation

export type EstimateValuesResult =
  { ok: true } | ({ ok: false; error: string } & EstimateValuesError)

/** The first descending pair among the values filled in so far (null = not yet
 *  typed), so a violation can be flagged before the third value exists. This is
 *  the single home of the ordering rule: validateEstimateValues() uses it too. */
export function findOrderViolation(
  best: number | null,
  likely: number | null,
  worst: number | null,
): OrderViolation | null {
  if (best !== null && likely !== null && best > likely) {
    return { code: 'best-above-likely', fields: ['best', 'likely'] }
  }
  if (likely !== null && worst !== null && likely > worst) {
    return { code: 'likely-above-worst', fields: ['likely', 'worst'] }
  }
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
      error: 'best, likely, and worst must all be finite numbers',
      code: 'not-finite',
      fields: notFinite.map(([field]) => field),
    }
  }
  // best is the smallest of the three once the ordering check below passes, so checking
  // it alone is enough to guarantee likely and worst are positive too.
  if (best <= 0) {
    return {
      ok: false,
      error: 'best, likely, and worst must all be greater than 0',
      code: 'non-positive',
      fields: ['best'],
    }
  }
  const violation = findOrderViolation(best, likely, worst)
  if (violation) {
    return {
      ok: false,
      error: 'best must be ≤ likely, and likely must be ≤ worst',
      ...violation,
    }
  }
  return { ok: true }
}

export function createEstimate(input: RawEstimateInput): Result<Estimate> {
  const { participantId, best, likely, worst } = input

  if (participantId.trim().length === 0) {
    return { ok: false, error: 'participantId must not be empty' }
  }
  const values = validateEstimateValues(best, likely, worst)
  if (!values.ok) return { ok: false, error: values.error }

  return { ok: true, value: input as Estimate }
}
