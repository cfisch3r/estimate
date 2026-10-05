import type { UncertaintyGuidance } from '../../../entities/estimate'
import { ConfirmNote } from '../../../shared/ui/ConfirmNote'
import { GuardNote } from '../../../shared/ui/GuardNote'
import { formatValue } from '../../../shared/ui/format'

interface UncertaintyGuidanceNotesProps {
  guidance: UncertaintyGuidance | null
  worst: number
  unitSuffix: string
}

/** The two notes that accompany a guidance-aware RangeBar (PRD §6.1) — a calm
 *  confirmation when the entered range already covers the phase's guidance
 *  ceiling, or a soft nudge when it's narrower than guidance. Shared by
 *  Workspace's ActiveItemPanel and ParticipantEstimateView's EstimateForm. */
export function UncertaintyGuidanceNotes({
  guidance,
  worst,
  unitSuffix,
}: UncertaintyGuidanceNotesProps) {
  if (guidance === null) {
    return null
  }

  return (
    <>
      {guidance.covered && (
        <ConfirmNote>
          Your worst case ({formatValue(worst)}
          {unitSuffix}) already covers this phase&rsquo;s guidance ceiling of{' '}
          {formatValue(guidance.guidanceHigh)}
          {unitSuffix}.
        </ConfirmNote>
      )}
      {guidance.guard.fired && (
        <GuardNote variant="banner" headline="Narrow range for this phase">
          Teams at this stage typically see a wider spread between best and worst case.
        </GuardNote>
      )}
    </>
  )
}
