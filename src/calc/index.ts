export type {
  Estimate,
  AggregateStrategy,
  AggregateResult,
  GuardResult,
  EstimationUnit,
} from './types'
export { DEFAULT_STRATEGY, UNIT_GRANULARITY } from './types'
export { aggregateEstimates } from './aggregate'
export { computeCI90 } from './ci90'
export { checkSymmetricRange, checkFalsePrecision, checkOutlier } from './guards'
