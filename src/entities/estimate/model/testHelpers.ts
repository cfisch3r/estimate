import { createEstimate, type Estimate } from './estimate'

/** Test-only convenience for building a valid Estimate; throws if the given values
 *  don't satisfy createEstimate()'s invariants, so a malformed test fixture fails
 *  loudly instead of silently testing the wrong thing. */
export function est(
  participantId: string,
  best: number,
  likely: number,
  worst: number,
): Estimate {
  const result = createEstimate({ participantId, best, likely, worst })
  if (!result.ok) {
    throw new Error(`Test helper est() produced an invalid estimate: ${result.error}`)
  }
  return result.value
}
