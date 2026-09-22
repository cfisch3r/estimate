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

/** The 5 phases of the "cone of uncertainty" a participant can optionally select
 *  per item, for their own view only (PRD §6.1). Order matches the Phase Picker's
 *  axis, index 0 = earliest/least certain. */
export const UNCERTAINTY_LEVELS = [
  'initial-concept',
  'approved-product-definition',
  'requirements-complete',
  'ui-complete',
  'detailed-design-complete',
] as const

export type UncertaintyLevel = (typeof UNCERTAINTY_LEVELS)[number]

/** Runtime guard, mirroring isEstimationUnit. */
export function isUncertaintyLevel(value: unknown): value is UncertaintyLevel {
  return (UNCERTAINTY_LEVELS as readonly unknown[]).includes(value)
}

/** Cone-of-uncertainty guidance table (PRD §6.1). `lowMult`/`highMult` are both
 *  anchored to Best Case, not Most Likely: `guidanceHigh = bestCase * (highMult /
 *  lowMult)`. The ratio itself is deliberately not a stored field here — always
 *  derive it as highMult/lowMult so a rounded display value can't drift from the
 *  exact division. */
export const UNCERTAINTY_GUIDANCE: Record<
  UncertaintyLevel,
  { label: string; agileEquivalent: string; lowMult: number; highMult: number }
> = {
  'initial-concept': {
    label: 'Initial Concept',
    agileEquivalent: 'Product Vision',
    lowMult: 0.25,
    highMult: 4,
  },
  'approved-product-definition': {
    label: 'Approved Product Definition',
    agileEquivalent: 'Backlog w/ Epics',
    lowMult: 0.5,
    highMult: 2,
  },
  'requirements-complete': {
    label: 'Requirements Complete',
    agileEquivalent: 'Refined Stories',
    lowMult: 0.67,
    highMult: 1.5,
  },
  'ui-complete': {
    label: 'UI Complete',
    agileEquivalent: 'Sprint Planning I',
    lowMult: 0.8,
    highMult: 1.25,
  },
  'detailed-design-complete': {
    label: 'Detailed Design Complete',
    agileEquivalent: 'Sprint Planning II',
    lowMult: 0.9,
    highMult: 1.1,
  },
}

/** Default selection when a participant hasn't picked a phase yet — index 2,
 *  "Requirements Complete." */
export const DEFAULT_UNCERTAINTY_INDEX = 2
