import type { RosterEntry } from './types'

/** Where this participant's own estimate stands with the facilitator, derived
 *  rather than tracked as its own store field: `submitted` comes straight from
 *  the roster (the actual convergence proof, per ADR-003), so a background
 *  resend that lands is reflected automatically with no wiring back to the
 *  caller. `sending` / `not-delivered` describe only the most recent local
 *  send attempt. */
export type DeliveryState = 'sending' | 'submitted' | 'not-delivered'

export function deliveryStateFor(
  roster: RosterEntry[] | undefined,
  participantId: string,
  sendFailed: boolean,
): DeliveryState {
  const mine = roster?.find((entry) => entry.participantId === participantId)
  if (mine?.submitted) return 'submitted'
  return sendFailed ? 'not-delivered' : 'sending'
}
