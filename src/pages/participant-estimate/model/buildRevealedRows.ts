import type { Estimate } from '../../../entities/estimate'
import { announcedName, teammateLabel } from '../../../entities/session'

export interface RevealedRow {
  participantId: string
  label: string
  estimate: Estimate
}

/** The revealed list's rows: "You" for this client, otherwise the announced
 *  name, falling back to a "Teammate N" label. Every non-self row consumes a
 *  teammate number (whether or not it also has an announced name), so a given
 *  peer's "Teammate N" stays put when a *different* peer's announce arrives. */
export function buildRevealedRows(
  submissions: Estimate[],
  participantId: string,
  participantNames: Record<string, string>,
): RevealedRow[] {
  let teammateNo = 0
  return submissions.map((estimate) => {
    const isMe = estimate.participantId === participantId
    const ordinal = isMe ? 0 : ++teammateNo
    const label = isMe
      ? 'You'
      : (announcedName(participantNames, estimate.participantId) ??
        teammateLabel(ordinal))
    return { participantId: estimate.participantId, label, estimate }
  })
}
