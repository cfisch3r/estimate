import type { GuardResult } from '../calc'
import { ConfirmNote } from './ConfirmNote'
import { GuardNote } from './GuardNote'
import { formatValue } from './format'

interface UncertaintyGuidanceNotesProps {
  guidanceHigh: number | null
  worst: number
  unitSuffix: string
  uncertaintyGuard: GuardResult | null
}

/** The two notes that accompany a guidance-aware RangeBar (PRD §6.1) — a calm
 *  confirmation when the entered range already covers the phase's guidance
 *  ceiling, or a soft nudge when it's narrower than guidance. Shared by
 *  Workspace's ActiveItemPanel and ParticipantEstimateView's EstimateForm. */
export function UncertaintyGuidanceNotes({
  guidanceHigh,
  worst,
  unitSuffix,
  uncertaintyGuard,
}: UncertaintyGuidanceNotesProps) {
  if (guidanceHigh === null) {
    return null
  }

  return (
    <>
      {worst >= guidanceHigh && (
        <ConfirmNote>
          Your worst case ({formatValue(worst)}
          {unitSuffix}) already covers this phase&rsquo;s guidance ceiling of{' '}
          {formatValue(guidanceHigh)}
          {unitSuffix}.
        </ConfirmNote>
      )}
      {uncertaintyGuard?.fired && (
        <GuardNote variant="banner" headline="Narrow range for this phase">
          Teams at this stage typically see a wider spread between best and worst case.
        </GuardNote>
      )}
    </>
  )
}
