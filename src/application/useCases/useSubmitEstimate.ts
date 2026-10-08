import { useState } from 'react'
import { deliveryStateFor } from '../../domain/delivery'
import { createEstimate, type ActionResult } from '../../domain/estimate'
import { LOCAL_PARTICIPANT_ID } from '../../domain/participantId'
import { useConnectionStore, useRoundStore } from '../stores'
import { useNetworkSession } from '../ports/useNetworkSession'

/** The participant-side submit use case: record the estimate locally, then send
 *  it to the facilitator and track whether that send failed. */
export function useSubmitEstimate() {
  const liveRound = useRoundStore((s) => s.liveRound)
  const submitEstimate = useRoundStore((s) => s.submitEstimate)
  const participantId = useConnectionStore((s) => s.participantId)
  const { sendEstimate } = useNetworkSession()
  // Tracks only the most recent local send attempt; the roster convergence
  // check in NetworkProvider can also resend in the background, and that path
  // is reflected below purely through the roster, without touching this flag.
  const [deliveryFailed, setDeliveryFailed] = useState(false)

  function submit(best: number, likely: number, worst: number): ActionResult {
    // Read the round at call time, not from the render closure: the store write
    // below uses call-time state, so the existence check and the item id / round
    // sent to the facilitator must come from the same snapshot of it.
    const round = useRoundStore.getState().liveRound
    if (!round) {
      return {
        ok: false,
        error:
          'There is no active round to estimate. Wait for the facilitator to start an item.',
      }
    }
    const result = createEstimate({
      participantId: participantId || LOCAL_PARTICIPANT_ID,
      best,
      likely,
      worst,
    })
    if (!result.ok) return result
    submitEstimate(result.value)
    setDeliveryFailed(false)
    sendEstimate(round.item.id, result.value, round.round).catch(() => {
      setDeliveryFailed(true)
    })
    return { ok: true }
  }

  const deliveryState = deliveryStateFor(liveRound?.roster, participantId, deliveryFailed)

  return { submit, deliveryState }
}
