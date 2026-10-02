import { announcedName, teammateLabel } from '../../../entities/participant'
import type { Item } from '../../../entities/session'

export interface FacilitatorRosterRow {
  id: string
  label: string
  submission: { best: number; likely: number; worst: number } | null
}

/** The people the facilitator is waiting on: every announced non-facilitator
 *  client, plus anyone whose submission arrived before their announce did.
 *  Announced names win; the rest get a stable "Teammate N". */
export function buildRoster(
  item: Item,
  participantNames: Record<string, string>,
): FacilitatorRosterRow[] {
  const submissionById = new Map(item.submissions.map((s) => [s.participantId, s]))
  const ids = [
    ...Object.keys(participantNames).filter((id) => id !== 'facilitator'),
    ...item.submissions.map((s) => s.participantId),
  ]
  const seen = new Set<string>()
  let teammateNo = 0
  const rows: FacilitatorRosterRow[] = []
  for (const id of ids) {
    if (seen.has(id)) continue
    seen.add(id)
    const named = announcedName(participantNames, id)
    const submission = submissionById.get(id)
    rows.push({
      id,
      label: named ?? teammateLabel(++teammateNo),
      submission: submission
        ? {
            best: submission.best,
            likely: submission.likely,
            worst: submission.worst,
          }
        : null,
    })
  }
  return rows
}
