import { useState } from 'react'
import {
  checkSymmetricRange,
  validateEstimateValues,
  type EstimationUnit,
  type GuardResult,
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
  best: string
  likely: string
  worst: string
  setBest: (value: string) => void
  setLikely: (value: string) => void
  setWorst: (value: string) => void
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
  guidanceHigh: number | null
  uncertaintyGuard: GuardResult | null
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
  const [best, setBest] = useState(initial ? String(initial.best) : '')
  const [likely, setLikely] = useState(initial ? String(initial.likely) : '')
  const [worst, setWorst] = useState(initial ? String(initial.worst) : '')

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

  const { phaseIndex, setPhaseIndex, guidanceHigh, uncertaintyGuard } = usePhaseGuidance(
    bestNum,
    worstNum,
    allFilled,
  )

  return {
    best,
    likely,
    worst,
    setBest,
    setLikely,
    setWorst,
    bestNum,
    likelyNum,
    worstNum,
    issue,
    flushIssue,
    valid: validation?.ok ?? false,
    symmetricGuard,
    phaseIndex,
    setPhaseIndex,
    guidanceHigh,
    uncertaintyGuard,
  }
}
