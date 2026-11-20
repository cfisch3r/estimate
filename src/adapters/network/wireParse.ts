import {
  createAggregateResult,
  createEstimate,
  isEstimationUnit,
  type AggregateResult,
  type EstimationUnit,
  type RawEstimateInput,
} from '../../domain/estimate'

/** The wire layer's anti-corruption boundary for estimates: every estimate that
 *  crosses the network — an incoming peer message, a snapshot's frozen
 *  submissions, or the participant's own values rebuilt for a resend — becomes an
 *  `Estimate` only through `createEstimate()`, never by trusting the payload's
 *  shape.
 *
 *  `createEstimate()` assumes a well-shaped `RawEstimateInput` (its form callers
 *  always build one) and throws on null/missing fields rather than returning a
 *  `Result`. Peer messages are untrusted, so that throw must not escape — it is
 *  caught and reported as a validation failure. */
export function parseWireEstimate(input: unknown): ReturnType<typeof createEstimate> {
  try {
    return createEstimate(input as RawEstimateInput)
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/** A peer's estimation unit, or `fallback` when it is missing or unknown (an
 *  older facilitator build mid-deploy) — tolerated rather than dropping the
 *  whole snapshot. */
export function parseWireUnit(input: unknown, fallback: EstimationUnit): EstimationUnit {
  return isEstimationUnit(input) ? input : fallback
}

/** A snapshot's final result, or null when it is missing (an older facilitator
 *  build), null (a pending item) or breaks a rule. It becomes an
 *  `AggregateResult` only through `createAggregateResult()`, like a final result
 *  read from a session file; a bad value never drops the whole snapshot. */
export function parseWireFinalResult(input: unknown): AggregateResult | null {
  if (typeof input !== 'object' || input === null) return null
  const { min, expected, max, ci90 } = input as Record<string, unknown>
  if (![min, expected, max, ci90].every((value) => typeof value === 'number')) return null
  const result = createAggregateResult({
    min: min as number,
    expected: expected as number,
    max: max as number,
    ci90: ci90 as number,
  })
  return result.ok ? result.value : null
}
