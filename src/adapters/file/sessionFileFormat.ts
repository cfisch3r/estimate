import type { SessionFileRejection } from '../../application/ports/outbound/sessionFiles'
import type { AggregateValues, Result } from '../../domain/estimate'
import { createSavedSession } from '../../domain/savedSession'
import type { SavedSession, SavedSessionInput } from '../../domain/savedSession'

/** The only format version this build writes and reads. */
const VERSION = 1

/** A session file's MIME type: it is JSON. */
export const SESSION_FILE_CONTENT_TYPE = 'application/json'

/** The text of a version-1 session file for `session`. */
export function writeSessionFile(session: SavedSession): string {
  return JSON.stringify({
    version: VERSION,
    sessionName: session.sessionName,
    unit: session.unit,
    items: session.items.map(({ id, title, description, notes, finalResult }) => ({
      id,
      title,
      description,
      notes,
      finalResult,
    })),
  })
}

type FileShape = { version: number } & SavedSessionInput
type FileItem = SavedSessionInput['items'][number]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFinalResultShape(value: unknown): value is AggregateValues | null {
  if (value === null) return true
  if (!isRecord(value)) return false
  return (['min', 'expected', 'max', 'ci90'] as const).every(
    (key) => typeof value[key] === 'number',
  )
}

function isFileItem(value: unknown): value is FileItem {
  return (
    isRecord(value) &&
    (['id', 'title', 'description', 'notes'] as const).every(
      (key) => typeof value[key] === 'string',
    ) &&
    isFinalResultShape(value.finalResult)
  )
}

function hasFileShape(value: unknown): value is FileShape {
  return (
    isRecord(value) &&
    typeof value.version === 'number' &&
    typeof value.sessionName === 'string' &&
    typeof value.unit === 'string' &&
    Array.isArray(value.items) &&
    value.items.every(isFileItem)
  )
}

function parse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

/**
 * Reads a session file's text: the whole session, or why the file can't be
 * loaded — never part of a session. The file is untrusted, so it becomes a
 * `SavedSession` only through `createSavedSession()`, whose refusal comes
 * back as it is.
 */
export function readSessionFile(
  text: string,
): Result<SavedSession, SessionFileRejection> {
  const file = parse(text)
  if (!hasFileShape(file)) return { ok: false, error: { code: 'not-a-session-file' } }
  if (file.version > VERSION) return { ok: false, error: { code: 'newer-version' } }
  if (file.version !== VERSION)
    return { ok: false, error: { code: 'not-a-session-file' } }
  const { sessionName, unit, items } = file
  return createSavedSession({
    sessionName,
    unit,
    items: items.map(({ id, title, description, notes, finalResult }) => ({
      id,
      title,
      description,
      notes,
      finalResult,
    })),
  })
}
