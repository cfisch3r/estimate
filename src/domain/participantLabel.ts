/** The name a participant announced for themselves, if any. `Object.hasOwn`
 *  guards against an untrusted participantId that collides with an
 *  Object.prototype key ("toString", "constructor", …). */
export function announcedName(
  names: Record<string, string>,
  participantId: string,
): string | undefined {
  return Object.hasOwn(names, participantId) ? names[participantId] : undefined
}

/** The fallback label for a participant who hasn't announced a name. Callers
 *  own how ordinals are assigned (each screen needs a different stability rule). */
export function teammateLabel(ordinal: number): string {
  return `Teammate ${ordinal}`
}

/** The display labels for `ids`, in order — the single labelling rule both
 *  reveal screens use, so a given peer reads the same on the facilitator's and
 *  the participant's view. An announced name wins; otherwise the peer gets
 *  "Teammate N", where N counts *every* non-self id up to and including it
 *  (named or not). Counting named peers too is what keeps a peer's number
 *  stable when a different peer's announce arrives later. `self`, when given,
 *  is labelled as such and consumes no number. */
export function participantLabels(
  ids: readonly string[],
  names: Record<string, string>,
  self?: { id: string; label: string },
): string[] {
  let ordinal = 0
  return ids.map((id) => {
    if (self && id === self.id) return self.label
    ordinal += 1
    return announcedName(names, id) ?? teammateLabel(ordinal)
  })
}
