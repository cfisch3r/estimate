import { useState } from 'react'
import { Button, GuardNote, LiveRegion } from '../../../shared/ui'
import { useSingleInfoPopover } from '../../../shared/lib/useSingleInfoPopover'
import type { EstimateValues, EstimationUnit } from '../../../entities/estimate'
import { ThreePointEstimateForm } from '../../../features/estimate-round'
import type { SubmitResult } from '../../../features/submit-estimate'

interface EstimateFormProps {
  unit: EstimationUnit
  initial: EstimateValues | null
  submitLabel: string
  focusOnMount?: boolean
  statusLine?: string
  onSubmit: (best: number, likely: number, worst: number) => SubmitResult
}

/** The estimating (5c) and revise-before-reveal (5d) form: the shared
 *  three-point form plus this view's submit button and status line. */
export function EstimateForm({
  unit,
  initial,
  submitLabel,
  focusOnMount,
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
      focusOnMount={focusOnMount}
      footer={({ valid, best, likely, worst }) => (
        <>
          <LiveRegion role="alert">
            {valid && submitError && (
              <GuardNote variant="banner" headline="Couldn't submit">
                {submitError}
              </GuardNote>
            )}
          </LiveRegion>

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
