import { announcedName, teammateLabel } from '../../../entities/participant'
import type { EstimateValues } from '../../../entities/estimate'
import { roundMemberIds, type Item } from '../../../entities/session'

export interface FacilitatorRosterRow {
  id: string
  label: string
  submission: EstimateValues | null
}

/** The people the facilitator is waiting on, labelled and paired with their
 *  submitted values (membership comes from `roundMemberIds`). Announced names
 *  win; the rest get a stable "Teammate N". */
export function buildRoster(
  item: Item,
  participantNames: Record<string, string>,
): FacilitatorRosterRow[] {
  const submissionById = new Map(item.submissions.map((s) => [s.participantId, s]))
  let teammateNo = 0
  return roundMemberIds(
    participantNames,
    item.submissions.map((s) => s.participantId),
  ).map((id) => {
    const named = announcedName(participantNames, id)
    const submission = submissionById.get(id)
    return {
      id,
      label: named ?? teammateLabel(++teammateNo),
      submission: submission
        ? { best: submission.best, likely: submission.likely, worst: submission.worst }
        : null,
    }
  })
}
