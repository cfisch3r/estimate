import { useState } from 'react'
import { Button, LiveRegion } from '../../../shared/ui'
import { useSingleInfoPopover } from '../../../shared/lib/useSingleInfoPopover'
import type { EstimationUnit } from '../../../entities/estimate'
import { ThreePointEstimateForm } from '../../../features/estimate-round'
import type { SubmitResult } from '../../../features/submit-estimate'

interface EstimateFormProps {
  unit: EstimationUnit
  initial: { best: number; likely: number; worst: number } | null
  submitLabel: string
  statusLine?: string
  onSubmit: (best: number, likely: number, worst: number) => SubmitResult
}

/** The estimating (5c) and revise-before-reveal (5d) form: the shared
 *  three-point form plus this view's submit button and status line. */
export function EstimateForm({
  unit,
  initial,
  submitLabel,
  statusLine,
  onSubmit,
}: EstimateFormProps) {
  const [submitError, setSubmitError] = useState<string | null>(null)
  const info = useSingleInfoPopover<'estimate' | 'phase' | 'range'>()

  return (
    <ThreePointEstimateForm
      unit={unit}
      initial={initial}
      info={info}
      error={submitError}
      footer={({ valid, best, likely, worst }) => (
        <>
          <Button
            variant="primary"
            disabled={!valid}
            onClick={() => {
              const result = onSubmit(best, likely, worst)
              setSubmitError(result.ok ? null : result.error)
            }}
          >
            {submitLabel}
          </Button>

          <LiveRegion>
            {statusLine && (
              <p
                className="text-muted"
                style={{ margin: 0, fontSize: 13, textAlign: 'center' }}
              >
                {statusLine}
              </p>
            )}
          </LiveRegion>
        </>
      )}
    />
  )
}
