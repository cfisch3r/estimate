import type { EstimateValues } from '../../../domain/estimate'
import { participantLabels } from '../../../domain/participantLabel'
import { roundMemberIds } from '../../../domain/roster'
import type { Item } from '../../../domain/types'

export interface FacilitatorRow {
  id: string
  label: string
  submission: EstimateValues | null
}

/** The people the facilitator is waiting on, labelled and paired with their
 *  submitted values (membership comes from `roundMemberIds`; labels from the
 *  shared `participantLabels` rule, so a peer reads the same here as on a
 *  participant's revealed list). Distinct from the values-free wire roster
 *  built by the session entity. */
export function buildFacilitatorRows(
  item: Item,
  participantNames: Record<string, string>,
): FacilitatorRow[] {
  const submissionById = new Map(item.submissions.map((s) => [s.participantId, s]))
  const ids = roundMemberIds(
    participantNames,
    item.submissions.map((s) => s.participantId),
  )
  const labels = participantLabels(ids, participantNames)
  return ids.map((id, index) => {
    const submission = submissionById.get(id)
    return {
      id,
      label: labels[index]!,
      submission: submission
        ? { best: submission.best, likely: submission.likely, worst: submission.worst }
        : null,
    }
  })
}
