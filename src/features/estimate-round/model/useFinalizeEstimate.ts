import { aggregateEstimates, createEstimate } from '../../../entities/session'
import { FACILITATOR_PARTICIPANT_ID, useRoundStore } from '../../../entities/session'

export type FinalizeResult = { ok: true } | { ok: false; error: string }

/** The single-user finalize use case: the facilitator's own three-point estimate
 *  for an item is validated, aggregated, and recorded as the item's final result.
 *  Navigation after a successful finalize is left to the caller. */
export function useFinalizeEstimate() {
  const finalizeItem = useRoundStore((s) => s.finalizeItem)

  return function finalize(
    id: string,
    best: number,
    likely: number,
    worst: number,
  ): FinalizeResult {
    const estimate = createEstimate({
      participantId: FACILITATOR_PARTICIPANT_ID,
      best,
      likely,
      worst,
    })
    if (!estimate.ok) return estimate
    finalizeItem(id, aggregateEstimates([estimate.value]))
    return { ok: true }
  }
}
