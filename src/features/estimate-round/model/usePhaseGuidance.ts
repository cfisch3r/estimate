import { useState } from 'react'
import {
  DEFAULT_UNCERTAINTY_INDEX,
  UNCERTAINTY_LEVELS,
  type UncertaintyLevel,
} from '../../../entities/estimate'

interface PhaseSelection {
  phaseIndex: number
  setPhaseIndex: (index: number) => void
  level: UncertaintyLevel
}

/** The cone-of-uncertainty phase a person has selected for their own view
 *  (PRD §6.1). Only the selection lives here; what the phase means for an entered
 *  range is `uncertaintyGuidance` in entities/estimate. */
export function usePhaseGuidance(): PhaseSelection {
  const [phaseIndex, setPhaseIndex] = useState(DEFAULT_UNCERTAINTY_INDEX)
  return { phaseIndex, setPhaseIndex, level: UNCERTAINTY_LEVELS[phaseIndex]! }
}
