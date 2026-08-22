import type { GuardResult } from './types'
import type { Estimate } from './estimate'
import { median } from './aggregate'

/** PRD §6 "symmetric range" nudge: fires when (Likely-Best) and (Worst-Likely) are
 *  close to equal, which usually means the worst case hasn't been given the extra
 *  room software estimates need. A gentle nudge, not a block. */
export function checkSymmetricRange(
  best: number,
  likely: number,
  worst: number,
  tolerance = 0.15,
): GuardResult {
  const totalRange = worst - best
  if (totalRange <= 0) {
    return { fired: false }
  }
  const bestSpan = likely - best
  const worstSpan = worst - likely
  const deviationPct = Math.abs(bestSpan - worstSpan) / totalRange
  return { fired: deviationPct <= tolerance, deviationPct }
}

/** PRD §6 "false precision" nudge: fires when a value isn't a multiple of the
 *  unit's expected rounding granularity (see UNIT_GRANULARITY in types.ts). */
export function checkFalsePrecision(value: number, granularity: number): GuardResult {
  if (granularity <= 0) {
    return { fired: false }
  }
  const epsilon = 1e-9
  const remainder = Math.abs(value % granularity)
  const distanceToNearestMultiple = Math.min(remainder, granularity - remainder)
  const deviationPct = distanceToNearestMultiple / granularity
  return { fired: deviationPct > epsilon, deviationPct }
}

/** Ordering nudge for the in-progress form: fires as soon as any two filled values
 *  are out of order, rather than waiting for all three fields (best/likely/worst) to
 *  be filled. Lets a participant catch e.g. best > worst immediately, before typing
 *  the third value. */
export function checkAscendingOrder(
  best: number | null,
  likely: number | null,
  worst: number | null,
): GuardResult {
  const pairs: [number | null, number | null][] = [
    [best, likely],
    [likely, worst],
    [best, worst],
  ]
  const fired = pairs.some(([a, b]) => a !== null && b !== null && a > b)
  return { fired }
}

/** PRD §6 "outlier flag": compares one estimate against the rest of the group
 *  (deliberately excludes itself, so a participant is never compared to a range
 *  that already includes their own submission). Fires if the estimate's range
 *  doesn't overlap the others' range at all, or its Likely value sits far from
 *  the others' median relative to their spread. */
export function checkOutlier(
  estimate: Estimate,
  allEstimates: Estimate[],
  thresholdPct = 0.4,
): GuardResult {
  const others = allEstimates.filter((e) => e.participantId !== estimate.participantId)
  if (others.length === 0) {
    return { fired: false }
  }

  const othersMin = Math.min(...others.map((e) => e.best))
  const othersMax = Math.max(...others.map((e) => e.worst))
  const noOverlap = estimate.worst < othersMin || estimate.best > othersMax

  const othersSpread = othersMax - othersMin
  if (othersSpread <= 0) {
    return { fired: noOverlap }
  }

  const othersMedianLikely = median(others.map((e) => e.likely))
  const deviationPct = Math.abs(estimate.likely - othersMedianLikely) / othersSpread
  return { fired: noOverlap || deviationPct > thresholdPct, deviationPct }
}
