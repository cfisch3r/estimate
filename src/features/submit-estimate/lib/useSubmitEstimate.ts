import { useState } from 'react'
import {
  useConnectionStore,
  useNetworkSession,
  useRoundStore,
} from '../../../entities/session'

export type SubmitResult = { ok: true } | { ok: false; error: string }

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

  function submit(best: number, likely: number, worst: number): SubmitResult {
    const result = submitEstimate(best, likely, worst)
    if (result.ok) {
      if (liveRound) {
        setDeliveryFailed(false)
        sendEstimate(liveRound.item.id, result.estimate, liveRound.round).catch(() => {
          setDeliveryFailed(true)
        })
      }
      return { ok: true }
    }
    return result
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
