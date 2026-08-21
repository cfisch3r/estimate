export interface RawEstimateInput {
  participantId: string
  best: number
  likely: number
  worst: number
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

export function createEstimate(input: RawEstimateInput): Result<Estimate> {
  const { participantId, best, likely, worst } = input

  if (participantId.trim().length === 0) {
    return { ok: false, error: 'participantId must not be empty' }
  }
  if (!Number.isFinite(best) || !Number.isFinite(likely) || !Number.isFinite(worst)) {
    return { ok: false, error: 'best, likely, and worst must all be finite numbers' }
  }
  // best is the smallest of the three once the ordering check below passes, so checking
  // it alone is enough to guarantee likely and worst are positive too.
  if (best <= 0) {
    return { ok: false, error: 'best, likely, and worst must all be greater than 0' }
  }
  if (!(best <= likely && likely <= worst)) {
    return { ok: false, error: 'best must be ≤ likely, and likely must be ≤ worst' }
  }

  return { ok: true, value: input as Estimate }
}
