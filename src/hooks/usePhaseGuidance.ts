import { useState } from 'react'
import {
  checkUncertaintyRange,
  DEFAULT_UNCERTAINTY_INDEX,
  UNCERTAINTY_GUIDANCE,
  UNCERTAINTY_LEVELS,
  type GuardResult,
  type UncertaintyLevel,
} from '../calc'

interface PhaseGuidance {
  phaseIndex: number
  setPhaseIndex: (index: number) => void
  level: UncertaintyLevel
  /** null when best/worst aren't both filled, or best isn't positive — the
   *  guidance ratio (highMult/lowMult) has nothing meaningful to anchor to
   *  at that point (PRD §6.1: anchored to Best Case). */
  guidanceHigh: number | null
  uncertaintyGuard: GuardResult | null
}

/** Cone-of-uncertainty phase selection + the guidance ceiling/guard derived from
 *  it (PRD §6.1) — shared by Workspace's ActiveItemPanel and
 *  ParticipantEstimateView's EstimateForm, the two places a person enters their
 *  own three-point estimate. */
export function usePhaseGuidance(
  best: number,
  worst: number,
  allFilled: boolean,
): PhaseGuidance {
  const [phaseIndex, setPhaseIndex] = useState(DEFAULT_UNCERTAINTY_INDEX)
  const level = UNCERTAINTY_LEVELS[phaseIndex]
  const hasValidGuidance = allFilled && best > 0

  if (!hasValidGuidance) {
    return {
      phaseIndex,
      setPhaseIndex,
      level,
      guidanceHigh: null,
      uncertaintyGuard: null,
    }
  }

  const { lowMult, highMult } = UNCERTAINTY_GUIDANCE[level]
  const guidanceHigh = best * (highMult / lowMult)
  const uncertaintyGuard = checkUncertaintyRange(best, worst, level)

  return { phaseIndex, setPhaseIndex, level, guidanceHigh, uncertaintyGuard }
}
