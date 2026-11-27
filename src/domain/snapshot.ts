import { isFinalized } from './item'
import { buildRoster } from './roster'
import type { Item, SessionSnapshot } from './types'
import type { EstimationUnit } from './estimate'

interface SnapshotInput {
  sessionName: string
  unit: EstimationUnit
  items: readonly Item[]
  activeItemId: string | null
  participantNames: Readonly<Record<string, string>>
  /** participantIds with at least one live connection right now. */
  connectedParticipantIds: ReadonlySet<string>
}

/** Facilitator: the live-session snapshot, computed fresh on demand — both as
 *  the payload of a change broadcast and as the answer to a participant's
 *  `requestSnapshot` pull. Estimate values reach participants only once
 *  revealed (ADR-003, "Single owner"); pre-reveal, the roster is what drives
 *  "N of M submitted". */
export function buildSessionSnapshot(input: SnapshotInput): SessionSnapshot {
  const active = input.items.find((item) => item.id === input.activeItemId) ?? null
  const revealed = active?.revealed ?? false
  return {
    currentItem: active
      ? { id: active.id, title: active.title, description: active.description }
      : null,
    sessionName: input.sessionName,
    unit: input.unit,
    revealed,
    round: active?.round ?? 0,
    roster: buildRoster(
      input.participantNames,
      active?.submissions.map((s) => s.participantId) ?? [],
      input.connectedParticipantIds,
    ),
    submissions: revealed && active ? active.submissions : [],
    finalizedItemIds: input.items.filter(isFinalized).map((item) => item.id),
    finalResult: active?.finalResult ?? null,
  }
}

/** What counts as a change worth broadcasting: everything but the frozen
 *  submission values, which only ever change together with `revealed`/`roster`. */
export function snapshotChangeKey(snapshot: SessionSnapshot): string {
  return JSON.stringify({
    currentItem: snapshot.currentItem,
    sessionName: snapshot.sessionName,
    unit: snapshot.unit,
    revealed: snapshot.revealed,
    round: snapshot.round,
    roster: snapshot.roster,
    finalizedItemIds: snapshot.finalizedItemIds,
    finalResult: snapshot.finalResult,
  })
}

/** The session-level fields a participant takes from the facilitator's
 *  snapshot: its name, and its unit, so participants estimate in the
 *  facilitator's unit, not their local default. Only a participant takes a
 *  snapshot: the facilitator's own session never hands one on. */
export function sessionFieldsFromSnapshot(snapshot: SessionSnapshot): {
  sessionName: string
  unit: EstimationUnit
} {
  return { sessionName: snapshot.sessionName, unit: snapshot.unit }
}
