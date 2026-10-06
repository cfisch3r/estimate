import { FACILITATOR_PARTICIPANT_ID } from './participantId'
import type { RosterEntry } from './types'

/** The people in a round, in a stable order: every announced non-facilitator
 *  client, then anyone whose submission arrived before their announce did.
 *  This is the single home of the round-membership rule — both the roster the
 *  facilitator broadcasts and the facilitator's own reveal panel derive their
 *  rows from it. */
export function roundMemberIds(
  participantNames: Readonly<Record<string, string>>,
  submissionIds: readonly string[],
): string[] {
  const ids = [
    ...Object.keys(participantNames).filter((id) => id !== FACILITATOR_PARTICIPANT_ID),
    ...submissionIds,
  ]
  return [...new Set(ids)]
}

/** The values-free roster that goes out over the wire (ADR-003, "Single
 *  owner"); the facilitator's own panel reads its local `item.submissions`
 *  for values instead. */
export function buildRoster(
  participantNames: Readonly<Record<string, string>>,
  submissionIds: readonly string[],
  connectedParticipantIds: ReadonlySet<string>,
): RosterEntry[] {
  const submitted = new Set(submissionIds)
  return roundMemberIds(participantNames, submissionIds).map((participantId) => ({
    participantId,
    submitted: submitted.has(participantId),
    connected: connectedParticipantIds.has(participantId),
  }))
}

/** Facilitator: whether a departed participant's display name should be
 *  forgotten. Not while another live connection still backs the same
 *  participantId (two tabs in one browser share one), and not once they have
 *  submitted — their estimate stays in the aggregate (ADR-003), and pruning
 *  the name would anonymise an otherwise still-attributed row on reveal. */
export function shouldPruneDeparted(
  participantId: string,
  stillConnectedParticipantIds: Iterable<string>,
  submissionIds: readonly string[],
): boolean {
  for (const id of stillConnectedParticipantIds) {
    if (id === participantId) return false
  }
  return !submissionIds.includes(participantId)
}
