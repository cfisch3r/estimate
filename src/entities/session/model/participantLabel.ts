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
