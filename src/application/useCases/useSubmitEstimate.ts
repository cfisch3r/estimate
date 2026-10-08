import { useState } from 'react'
import { createEstimate, type ActionResult } from '../../domain/estimate'
import { useConnectionStore, useRoundStore } from '../stores'
import { useNetworkSession } from '../ports/useNetworkSession'

/** Where this participant's own estimate stands with the facilitator, derived
 *  rather than tracked as its own store field: `submitted` comes straight from
 *  the roster (the actual convergence proof, per ADR-003), so a background
 *  resend that lands is reflected automatically with no wiring back to the
 *  caller. `sending` / `not-delivered` describe only the most recent local
 *  send attempt. */
export type DeliveryState = 'sending' | 'submitted' | 'not-delivered'

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
      participantId: participantId || 'me',
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

  const myRosterEntry = liveRound?.roster.find(
    (entry) => entry.participantId === participantId,
  )
  const deliveryState: DeliveryState = myRosterEntry?.submitted
    ? 'submitted'
    : deliveryFailed
      ? 'not-delivered'
      : 'sending'

  return { submit, deliveryState }
}
