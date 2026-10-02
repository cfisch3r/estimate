import { useState } from 'react'
import {
  checkSymmetricRange,
  validateEstimateValues,
  type GuardResult,
} from '../../../entities/estimate'
import { usePhaseGuidance } from './usePhaseGuidance'

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
  validationError: string | null
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
export function useThreePointDraft(initial: ThreePointInitial | null): ThreePointDraft {
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
  const validationError = validation && !validation.ok ? validation.error : null

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
    validationError,
    valid: validation?.ok ?? false,
    symmetricGuard,
    phaseIndex,
    setPhaseIndex,
    guidanceHigh,
    uncertaintyGuard,
  }
}
