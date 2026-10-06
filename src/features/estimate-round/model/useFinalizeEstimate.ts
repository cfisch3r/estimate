import {
  createEstimate,
  FACILITATOR_PARTICIPANT_ID,
  finalResultFor,
  useRoundStore,
  type ActionResult,
} from '../../../entities/session'

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
  ): ActionResult {
    const estimate = createEstimate({
      participantId: FACILITATOR_PARTICIPANT_ID,
      best,
      likely,
      worst,
    })
    if (!estimate.ok) return estimate
    const result = finalResultFor([estimate.value])
    if (!result.ok) return result
    finalizeItem(id, result.value)
    return { ok: true }
  }
}
