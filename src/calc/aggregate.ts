import type { AggregateResult, AggregateStrategy } from './types'
import { DEFAULT_STRATEGY } from './types'
import type { Estimate } from './estimate'
import { computeCI90 } from './ci90'

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2
  }
  return sorted[mid]!
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function reduceValues(values: number[], op: 'min' | 'max' | 'median' | 'mean'): number {
  switch (op) {
    case 'min':
      return Math.min(...values)
    case 'max':
      return Math.max(...values)
    case 'median':
      return median(values)
    case 'mean':
      return mean(values)
  }
}

/** Combines individual Best/Likely/Worst submissions into one group range (PRD §5).
 *  A single-element array degenerates to that estimate's own values unchanged — this
 *  is what lets Mode B (one facilitator-entered estimate) share this exact function
 *  with Mode A (many participant submissions), per ARCHITECTURE-estimation-app.md. */
export function aggregateEstimates(
  estimates: Estimate[],
  strategy: AggregateStrategy = DEFAULT_STRATEGY,
): AggregateResult {
  if (estimates.length === 0) {
    throw new Error('aggregateEstimates requires at least one estimate')
  }
  const min = reduceValues(
    estimates.map((e) => e.best),
    strategy.best,
  )
  const expected = reduceValues(
    estimates.map((e) => e.likely),
    strategy.likely,
  )
  const max = reduceValues(
    estimates.map((e) => e.worst),
    strategy.worst,
  )
  const ci90 = computeCI90(expected, min, max)
  return { min, expected, max, ci90 }
}
