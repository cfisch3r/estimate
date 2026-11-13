/** A calendar date in the user's own time zone. */
export type LocalDate = { year: number; month: number; day: number }

/**
 * The download name for a saved session: the slugified session name plus the
 * save date, ending in `.estimate.json`.
 *
 * Spec-first stub (ADR-010): satisfies the domain spec's import only, so
 * `specs/session-persistence/domain/` fails on its assertions. Not implemented.
 */
export function sessionFileName(_sessionName: string, _savedOn: LocalDate): string {
  return ''
}
