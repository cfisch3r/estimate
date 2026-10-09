import { createEstimate, type ActionResult } from '../../domain/estimate'
import { FACILITATOR_PARTICIPANT_ID } from '../../domain/participantId'
import { finalizeWith } from './finalizeWith'

/** The single-user finalize use case: the facilitator's own three-point estimate
 *  for an item is validated, aggregated, and recorded as the item's final result.
 *  Navigation after a successful finalize is left to the caller. */
export function finalizeEstimate(
  id: string,
  best: number,
  likely: number,
  worst: number,
): ActionResult {
  const estimate = createEstimate({
    participantId: FACILITATOR_PARTICIPANT_ID,
    best,
    likely,
    worst,
  })
  if (!estimate.ok) return estimate
  return finalizeWith(id, [estimate.value])
}
