import type { Estimate } from '../../../entities/session'
import { participantLabels } from '../../../entities/session'

export interface RevealedRow {
  participantId: string
  label: string
  estimate: Estimate
}

/** The revealed list's rows: "You" for this client, otherwise the announced
 *  name, falling back to a "Teammate N" label. Labelling is the shared
 *  `participantLabels` rule (every non-self row consumes a number), so a given
 *  peer's "Teammate N" stays put when a *different* peer's announce arrives and
 *  matches the facilitator's view. */
export function buildRevealedRows(
  submissions: Estimate[],
  participantId: string,
  participantNames: Record<string, string>,
): RevealedRow[] {
  const labels = participantLabels(
    submissions.map((e) => e.participantId),
    participantNames,
    { id: participantId, label: 'You' },
  )
  return submissions.map((estimate, index) => ({
    participantId: estimate.participantId,
    label: labels[index]!,
    estimate,
  }))
}
