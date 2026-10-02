import { formatValue } from '../../../shared/ui'
import type {
  EstimateField,
  EstimateValuesError,
  EstimationUnit,
} from '../../../entities/estimate'

/** What to tell the person about a rejected best / likely / worst entry: a short
 *  headline, one sentence saying what is wrong and with which numbers, and the
 *  inputs involved (so they can be marked invalid). */
export interface EstimateIssue {
  headline: string
  message: string
  fields: EstimateField[]
}

interface Values {
  best: number | null
  likely: number | null
  worst: number | null
}

const FIELD_LABEL: Record<EstimateField, string> = {
  best: 'Best case',
  likely: 'Most likely',
  worst: 'Worst case',
}

function withUnit(value: number, unit: EstimationUnit): string {
  const name = value === 1 ? unit.slice(0, -1) : unit
  return `${formatValue(value)} ${name}`
}

function describeField(field: EstimateField, values: Values, unit: EstimationUnit) {
  const value = values[field]
  return value === null
    ? FIELD_LABEL[field]
    : `${FIELD_LABEL[field]} (${withUnit(value, unit)})`
}

function orderingIssue(
  lower: EstimateField,
  higher: EstimateField,
  values: Values,
  unit: EstimationUnit,
): EstimateIssue {
  return {
    headline: 'Out of order',
    message: `${describeField(lower, values, unit)} is higher than ${describeField(higher, values, unit)}. Lower ${FIELD_LABEL[lower]} or raise ${FIELD_LABEL[higher]}.`,
    fields: [lower, higher],
  }
}

/** Turn a validator rejection into an actionable issue. */
export function describeEstimateIssue(
  error: EstimateValuesError,
  values: Values,
  unit: EstimationUnit,
): EstimateIssue {
  switch (error.code) {
    case 'best-above-likely':
      return orderingIssue('best', 'likely', values, unit)
    case 'likely-above-worst':
      return orderingIssue('likely', 'worst', values, unit)
    case 'non-positive':
      return {
        headline: 'Enter a positive value',
        message: `${describeField('best', values, unit)} must be greater than 0. Enter how many ${unit} it would take if everything goes well.`,
        fields: error.fields,
      }
    case 'not-finite': {
      const labels = error.fields.map((field) => FIELD_LABEL[field])
      return {
        headline: 'Enter a number',
        message: `${labels.join(' and ')} must be a number. Enter a value in ${unit}.`,
        fields: error.fields,
      }
    }
  }
}

/** The ordering problem in a partly filled entry, so a descending pair can be
 *  flagged before the third value is typed. Null when no filled pair descends. */
export function describePartialOrdering(
  values: Values,
  unit: EstimationUnit,
): EstimateIssue | null {
  const pairs: [EstimateField, EstimateField][] = [
    ['best', 'likely'],
    ['likely', 'worst'],
    ['best', 'worst'],
  ]
  for (const [lower, higher] of pairs) {
    const a = values[lower]
    const b = values[higher]
    if (a !== null && b !== null && a > b) {
      return orderingIssue(lower, higher, values, unit)
    }
  }
  return null
}
