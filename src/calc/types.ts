export interface AggregateStrategy {
  best: 'min' | 'median' | 'mean'
  likely: 'median' | 'mean'
  worst: 'max' | 'median' | 'mean'
}

export const DEFAULT_STRATEGY: AggregateStrategy = {
  best: 'min',
  likely: 'median',
  worst: 'max',
}

export interface AggregateResult {
  min: number
  expected: number
  max: number
  ci90: number
}

export interface GuardResult {
  fired: boolean
  deviationPct?: number
}

export const ESTIMATION_UNITS = ['hours', 'days', 'weeks'] as const

export type EstimationUnit = (typeof ESTIMATION_UNITS)[number]

/** Runtime guard for untrusted values (peer messages, persisted config). */
export function isEstimationUnit(value: unknown): value is EstimationUnit {
  return (ESTIMATION_UNITS as readonly unknown[]).includes(value)
}

/** Rounding granularity the false-precision guard expects per unit. Tunable — see
 *  docs/architecture.md's "Estimation unit" decision. */
export const UNIT_GRANULARITY: Record<EstimationUnit, number> = {
  hours: 1,
  days: 0.5,
  weeks: 0.5,
}

/** Short suffix for compact value labels, e.g. on the range bar. */
export const UNIT_SUFFIX: Record<EstimationUnit, string> = {
  hours: 'h',
  days: 'd',
  weeks: 'w',
}
