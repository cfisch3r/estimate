export type {
  AggregateStrategy,
  AggregateResult,
  GuardResult,
  EstimationUnit,
} from './types'
export { DEFAULT_STRATEGY, UNIT_GRANULARITY, UNIT_SUFFIX } from './types'
export type { Estimate, RawEstimateInput, Result } from './estimate'
export { createEstimate } from './estimate'
export { aggregateEstimates } from './aggregate'
export { computeCI90 } from './ci90'
export {
  checkSymmetricRange,
  checkFalsePrecision,
  checkOutlier,
  checkAscendingOrder,
} from './guards'
