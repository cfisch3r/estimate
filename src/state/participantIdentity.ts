const STORAGE_KEY = 'estimate.participantId'

/** A participant's id must survive a drop/rejoin in the same browser tab or window,
 *  so `item.submissions` (keyed by `participantId`) can tell a reconnect apart from a
 *  new person. Persisting it in `localStorage` means two tabs in the same browser
 *  share an identity — an accepted trade-off (see ADR-003), surfaced to the user as a
 *  warning in the join UI rather than solved here. */
export function getOrCreateParticipantId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY)
    if (existing !== null && existing.trim().length > 0) return existing

    const id = crypto.randomUUID()
    localStorage.setItem(STORAGE_KEY, id)
    return id
  } catch {
    // Storage blocked or unavailable (e.g. private browsing, locked-down browser
    // settings) — fall back to the pre-existing per-join behaviour rather than
    // failing the join outright.
    return crypto.randomUUID()
  }
}
