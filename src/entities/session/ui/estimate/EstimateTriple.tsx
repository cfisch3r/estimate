import { Fragment } from 'react'
import { formatValue } from '../../../../shared/ui/format'
import { UNIT_SUFFIX, type EstimationUnit } from '../../../../domain/estimate'

interface EstimateTripleProps {
  best: number
  likely: number
  worst: number
  unit: EstimationUnit
  /** Bold the numbers (the unit suffix stays regular weight). */
  emphasis?: boolean
}

/** One best / likely / worst triple rendered as "2d / 4d / 8d". */
export function EstimateTriple({
  best,
  likely,
  worst,
  unit,
  emphasis = false,
}: EstimateTripleProps) {
  const suffix = UNIT_SUFFIX[unit]

  return (
    <>
      {[best, likely, worst].map((value, index) => (
        <Fragment key={index}>
          {index > 0 && ' / '}
          {emphasis ? <strong>{formatValue(value)}</strong> : formatValue(value)}
          {suffix}
        </Fragment>
      ))}
    </>
  )
}
