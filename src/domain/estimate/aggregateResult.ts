import { computeCI90 } from './ci90'
import type { Result } from './estimate'
import type { AggregateResult, AggregateValues } from './types'

/** How far a stored 90% value may sit from the formula's before it counts as
 *  not matching: only the floating-point noise of writing and reading it back. */
const CI90_TOLERANCE = 1e-9

/** Why the values break a rule, as a clause that completes "A final result …"
 *  or "Item 1, "Login", …"; null when they keep every rule. */
function aggregateProblem({ min, expected, max, ci90 }: AggregateValues): string | null {
  if (![min, expected, max, ci90].every(Number.isFinite)) {
    return "has a value that isn't a finite number"
  }
  if (min <= 0) return 'has a minimum of 0 or less'
  if (min > max) return 'has a range where the minimum is above the maximum'
  if (expected < min || expected > max) return 'has an expected value outside its range'
  const formula = computeCI90(expected, min, max)
  if (Math.abs(ci90 - formula) > CI90_TOLERANCE * Math.max(1, Math.abs(formula))) {
    return "has a 90% value that doesn't match its range"
  }
  return null
}

/**
 * The only way to make an `AggregateResult`: the values must be finite, the
 * minimum above 0 (as an estimate's best case is), min ≤ expected ≤ max, and
 * the 90% value the one McConnell's formula gives for them. On a break, the
 * error is a clause naming the rule ("has a minimum of 0 or less").
 */
export function createAggregateResult(values: AggregateValues): Result<AggregateResult> {
  const problem = aggregateProblem(values)
  if (problem !== null) return { ok: false, error: problem }
  const { min, expected, max, ci90 } = values
  return { ok: true, value: { min, expected, max, ci90 } as AggregateResult }
}
