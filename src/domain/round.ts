import type { Estimate } from './estimate'
import { isFinalized } from './item'
import type { Item, LiveRound } from './types'

/** Upsert `next` into `list` keyed by participantId — last write wins, insertion
 *  order (and thus submission order) preserved for existing entries. */
export function upsertByParticipant(list: Estimate[], next: Estimate): Estimate[] {
  const index = list.findIndex((e) => e.participantId === next.participantId)
  if (index === -1) return [...list, next]
  const copy = [...list]
  copy[index] = next
  return copy
}

/** The round fields a Retry resets. Discards the round's submissions and returns
 *  it to the waiting state. Also used, behind a confirm step in the UI, to reopen
 *  an already-finalized item — clearing `finalResult` so a stale range doesn't
 *  linger next to the new round. Bumping `round` is what lets a participant that
 *  reconnects after missing both the Reveal and this Retry tell the new round
 *  apart from the old one (ADR-003, "Versioned rounds"). */
export function retryRoundPatch(
  item: Item,
): Pick<Item, 'submissions' | 'revealed' | 'round' | 'finalResult'> {
  return { submissions: [], revealed: false, round: item.round + 1, finalResult: null }
}

/** The facilitator's submission list for the active item after an incoming
 *  targeted estimate, or `null` when the estimate must be dropped.
 *
 *  Facilitator-only: `sendEstimate` targets the facilitator alone, so a
 *  participant never receives another peer's estimate (ADR-003, "Single owner").
 *  An estimate is recorded only if it is for the item the round is running on —
 *  a straggler for a just-finalized item must not seed the next round — and only
 *  while that round is still open: a late submission must not move a range the
 *  group has seen. */
export function acceptRemoteEstimate(
  active: Item | undefined,
  itemId: string,
  estimate: Estimate,
  round?: number,
): Estimate[] | null {
  if (
    !active ||
    // An empty itemId is a pre-#8 peer's bare estimate — record it against
    // the active round (legacy behaviour) rather than dropping it.
    (itemId && itemId !== active.id) ||
    active.revealed ||
    isFinalized(active) ||
    // A round mismatch means this submission belongs to a round the participant
    // hasn't caught up past yet (a stale in-flight send from before a Retry). A
    // missing `round` (older build) bypasses this check rather than being
    // treated as stale.
    (round !== undefined && round !== active.round)
  ) {
    return null
  }
  return upsertByParticipant(active.submissions, estimate)
}

/** The participant's round view after submitting their own (already valid)
 *  estimate, or `null` when there is no active round (the submit is a no-op). */
export function recordOwnSubmission(
  liveRound: LiveRound | null,
  estimate: Estimate,
): LiveRound | null {
  if (!liveRound) return null
  return {
    ...liveRound,
    mySubmission: estimate,
    submissions: upsertByParticipant(liveRound.submissions, estimate),
  }
}
