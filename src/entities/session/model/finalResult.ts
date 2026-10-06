import { aggregateEstimates } from './estimate'
import type { AggregateResult, Estimate, Result } from './estimate'

/** The finalize rule, shared by the facilitator's live finalize and the
 *  single-user finalize: a round can only be finalized from at least one
 *  submitted estimate, and the result is the aggregate of exactly those. */
export function finalResultFor(
  submissions: readonly Estimate[],
): Result<AggregateResult> {
  if (submissions.length === 0) {
    return { ok: false, error: 'No estimates have been submitted yet.' }
  }
  return { ok: true, value: aggregateEstimates([...submissions]) }
}
