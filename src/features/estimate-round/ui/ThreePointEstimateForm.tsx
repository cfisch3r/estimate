import type { ReactNode } from 'react'
import { GroupBox } from '../../../shared/ui/GroupBox'
import { GuardNote } from '../../../shared/ui/GuardNote'
import { PHASE_INFO, RANGE_INFO } from '../../../shared/copy'
import {
  computeCI90,
  RangeBar,
  UNIT_SUFFIX,
  type EstimationUnit,
} from '../../../entities/estimate'
import { useThreePointDraft, type ThreePointInitial } from '../lib/useThreePointDraft'
import { PhasePicker } from './PhasePicker'
import { ThreePointEstimateFields } from './ThreePointEstimateFields'
import { UncertaintyGuidanceNotes } from './UncertaintyGuidanceNotes'

type FormInfoKey = 'estimate' | 'phase' | 'range'

/** The shape of `useSingleInfoPopover`'s result. The caller owns it so it can
 *  share one open-popover slot with its own keys (e.g. a description popover
 *  outside the form). */
interface InfoPopover {
  openKey: string | null
  open: (key: FormInfoKey) => void
  close: () => void
}

interface ThreePointEstimateFormProps {
  unit: EstimationUnit
  initial: ThreePointInitial | null
  info: InfoPopover
  /** An extra error to show in the banner when the draft itself is valid, e.g. a
   *  rejected submit. */
  error?: string | null
  /** The actions below the form. Receives whether the draft is a valid estimate
   *  and its parsed values. */
  footer: (draft: {
    valid: boolean
    best: number
    likely: number
    worst: number
  }) => ReactNode
}

/** The Phase / Three-point / Range stack with the live bias guards, shared by the
 *  facilitator's Workspace and the participant's estimate view. Callers supply
 *  only what differs: the actions in `footer`. */
export function ThreePointEstimateForm({
  unit,
  initial,
  info,
  error,
  footer,
}: ThreePointEstimateFormProps) {
  const draft = useThreePointDraft(initial)
  const { openKey, open, close } = info
  const bannerError = draft.validationError ?? error

  return (
    <>
      <GroupBox
        label="Phase"
        info={PHASE_INFO}
        infoOpen={openKey === 'phase'}
        onInfoOpen={() => open('phase')}
        onInfoClose={close}
      >
        <PhasePicker index={draft.phaseIndex} onChange={draft.setPhaseIndex} />
      </GroupBox>

      <ThreePointEstimateFields
        unit={unit}
        best={draft.best}
        likely={draft.likely}
        worst={draft.worst}
        onBestChange={draft.setBest}
        onLikelyChange={draft.setLikely}
        onWorstChange={draft.setWorst}
        validationError={draft.validationError}
        infoOpen={openKey === 'estimate'}
        onInfoOpen={() => open('estimate')}
        onInfoClose={close}
      />

      <GroupBox
        label="Range"
        info={RANGE_INFO}
        infoOpen={openKey === 'range'}
        onInfoOpen={() => open('range')}
        onInfoClose={close}
      >
        {draft.valid ? (
          <>
            <RangeBar
              min={draft.bestNum}
              max={draft.worstNum}
              expected={draft.likelyNum}
              ci90={computeCI90(draft.likelyNum, draft.bestNum, draft.worstNum)}
              unitSuffix={UNIT_SUFFIX[unit]}
              guidance={
                draft.guidanceHigh !== null
                  ? { guidanceHigh: draft.guidanceHigh }
                  : undefined
              }
            />
            <UncertaintyGuidanceNotes
              guidanceHigh={draft.guidanceHigh}
              worst={draft.worstNum}
              unitSuffix={UNIT_SUFFIX[unit]}
              uncertaintyGuard={draft.uncertaintyGuard}
            />
          </>
        ) : (
          <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
            Enter best, most likely and worst case above to see the range.
          </p>
        )}
      </GroupBox>

      {draft.symmetricGuard?.fired && (
        <GuardNote variant="banner" headline="Symmetric range">
          Worst case in software usually has more room than best case. Double check.
        </GuardNote>
      )}
      {bannerError && (
        <GuardNote variant="banner" headline="Check your estimate">
          {bannerError}
        </GuardNote>
      )}

      {footer({
        valid: draft.valid,
        best: draft.bestNum,
        likely: draft.likelyNum,
        worst: draft.worstNum,
      })}
    </>
  )
}
