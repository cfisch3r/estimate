import type { EstimationUnit, Result } from './estimate'
import type { Item } from './types'

/** A calendar date in the user's own time zone. */
export type LocalDate = { year: number; month: number; day: number }

/** What a session file restores: the session's parameters and its items.
 *  Read items always start outside any live round. */
export type SavedSession = {
  sessionName: string
  unit: EstimationUnit
  items: Item[]
}

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

/**
 * The text of a version-1 session file for `session`, without any running
 * live round.
 *
 * Spec-first stub (ADR-010). Not implemented.
 */
export function writeSessionFile(_session: SavedSession): string {
  return ''
}

/**
 * Reads a session file's text: the whole session, or the reason the file
 * can't be loaded.
 *
 * Spec-first stub (ADR-010). Not implemented.
 */
export function readSessionFile(_text: string): Result<SavedSession> {
  return { ok: false, error: '' }
}
