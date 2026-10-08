import type { EstimateField } from '../../../domain/estimate'

/** The visible name of each best / likely / worst field — the one spelling used
 *  by the inputs' labels and by the validation messages that refer to them. */
export const ESTIMATE_FIELD_LABEL: Record<EstimateField, string> = {
  best: 'Best case',
  likely: 'Most likely',
  worst: 'Worst case',
}
