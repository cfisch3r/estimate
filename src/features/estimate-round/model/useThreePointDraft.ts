import { useState } from 'react'
import {
  checkSymmetricRange,
  uncertaintyGuidance,
  validateEstimateValues,
  type EstimateField,
  type EstimationUnit,
  type GuardResult,
  type UncertaintyGuidance,
} from '../../../entities/estimate'
import {
  describeEstimateIssue,
  describePartialOrdering,
  type EstimateIssue,
} from '../lib/describeEstimateIssue'
import { usePhaseGuidance } from './usePhaseGuidance'
import { useSettledIssue } from './useSettledIssue'

export interface ThreePointInitial {
  best: number
  likely: number
  worst: number
}

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
  initial: ThreePointInitial | null,
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

  const { phaseIndex, setPhaseIndex, level } = usePhaseGuidance()
  const guidance = allFilled ? uncertaintyGuidance(bestNum, worstNum, level) : null

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
