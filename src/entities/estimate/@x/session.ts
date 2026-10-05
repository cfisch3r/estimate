// Cross-import surface for `entities/session` (FSD `@x` notation): only what a
// live round needs from the estimate domain — its Estimate submissions,
// validation and aggregation. Keep this narrower than the slice's own barrel.
export type {
  AggregateResult,
  Estimate,
  EstimationUnit,
  EstimateValues,
  RawEstimateInput,
} from '../index'
export { aggregateEstimates, createEstimate, isEstimationUnit } from '../index'
