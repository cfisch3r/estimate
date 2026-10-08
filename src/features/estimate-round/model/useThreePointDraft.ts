import { useState } from 'react'
import {
  checkSymmetricRange,
  DEFAULT_UNCERTAINTY_INDEX,
  UNCERTAINTY_LEVELS,
  uncertaintyGuidance,
  validateEstimateValues,
  type EstimateField,
  type EstimateValues,
  type EstimationUnit,
  type GuardResult,
  type UncertaintyGuidance,
} from '../../../domain/estimate'
import {
  describeEstimateIssue,
  describePartialOrdering,
  type EstimateIssue,
} from '../lib/describeEstimateIssue'
import { useSettledIssue } from './useSettledIssue'

export interface ThreePointDraft {
  /** The raw text of each input. */
  values: Record<EstimateField, string>
  setField: (field: EstimateField, value: string) => void
  bestNum: number
  likelyNum: number
  worstNum: number
  /** What is wrong with the entry so far — a rejected full entry, or a descending
   *  pair in a partly filled one — once it has settled (see `useSettledIssue`), or
   *  null. `valid` is not delayed. */
  issue: EstimateIssue | null
  /** Show the current problem now instead of waiting for the entry to settle. */
  flushIssue: () => void
  /** True once the three values form a valid estimate. */
  valid: boolean
  symmetricGuard: GuardResult | null
  phaseIndex: number
  setPhaseIndex: (index: number) => void
  /** The phase's guidance for the entered range, or null until one is meaningful. */
  guidance: UncertaintyGuidance | null
}

/** The raw best / likely / worst entry state plus everything derived from it —
 *  `createEstimate` preview validation, the symmetric-range guard and the
 *  cone-of-uncertainty phase guidance. Shared by the facilitator's Workspace and
 *  the participant's estimate view, the two places a person types their own
 *  three-point estimate. */
export function useThreePointDraft(
  initial: EstimateValues | null,
  unit: EstimationUnit,
): ThreePointDraft {
  const [values, setValues] = useState<Record<EstimateField, string>>({
    best: initial ? String(initial.best) : '',
    likely: initial ? String(initial.likely) : '',
    worst: initial ? String(initial.worst) : '',
  })
  const { best, likely, worst } = values
  const setField = (field: EstimateField, value: string) =>
    setValues((current) => ({ ...current, [field]: value }))

  const allFilled = best !== '' && likely !== '' && worst !== ''
  const bestNum = Number(best)
  const likelyNum = Number(likely)
  const worstNum = Number(worst)

  const validation = allFilled
    ? validateEstimateValues(bestNum, likelyNum, worstNum)
    : null
  const currentIssue =
    validation && !validation.ok
      ? describeEstimateIssue(
          validation,
          { best: bestNum, likely: likelyNum, worst: worstNum },
          unit,
        )
      : describePartialOrdering(
          {
            best: best === '' ? null : bestNum,
            likely: likely === '' ? null : likelyNum,
            worst: worst === '' ? null : worstNum,
          },
          unit,
        )

  const { issue, flush: flushIssue } = useSettledIssue(currentIssue)

  const symmetricGuard = allFilled
    ? checkSymmetricRange(bestNum, likelyNum, worstNum)
    : null

  // The cone-of-uncertainty phase this person selected for their own view (PRD
  // §6.1). Only the selection lives here; what the phase means for an entered
  // range is `uncertaintyGuidance`. An out-of-range index yields no guidance.
  const [phaseIndex, setPhaseIndex] = useState(DEFAULT_UNCERTAINTY_INDEX)
  const level = UNCERTAINTY_LEVELS[phaseIndex]
  const guidance =
    allFilled && level ? uncertaintyGuidance(bestNum, worstNum, level) : null

  return {
    values,
    setField,
    bestNum,
    likelyNum,
    worstNum,
    issue,
    flushIssue,
    valid: validation?.ok ?? false,
    symmetricGuard,
    phaseIndex,
    setPhaseIndex,
    guidance,
  }
}
