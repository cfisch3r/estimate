import type { Estimate } from './estimate'
import type { LiveRound } from './types'

/** Participant: whether this client's own submission needs re-sending, judged
 *  from a freshly applied snapshot (ADR-003, "Acknowledged submissions"). True
 *  when the round is still open, this client has submitted locally, and the
 *  facilitator's roster doesn't yet show it as submitted — which recovers both
 *  a submission whose ack was lost on the way back and one that never arrived. */
export function needsResend(
  liveRound: LiveRound | null,
  participantId: string,
): liveRound is LiveRound & { mySubmission: Estimate } {
  if (!liveRound || liveRound.revealed || !liveRound.mySubmission) return false
  const myEntry = liveRound.roster.find((entry) => entry.participantId === participantId)
  return !myEntry?.submitted
}
