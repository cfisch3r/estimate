import { DEFAULT_ESTIMATION_UNIT, isEstimationUnit } from './estimate'
import type { AggregateResult, EstimationUnit, Result } from './estimate'
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

/** The only format version this build writes and reads. */
const VERSION = 1

const NOT_A_SESSION_FILE = "This isn't an EstiMate session file."

/** The fallback slug for a session whose name has no usable characters. */
const UNNAMED = 'estimate-session'

/**
 * The download name for a saved session: the slugified session name plus the
 * save date, ending in `.estimate.json` — so saved files in one downloads
 * folder stay apart and sort by date per session.
 */
export function sessionFileName(sessionName: string, savedOn: LocalDate): string {
  const slug =
    sessionName
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || UNNAMED
  const two = (n: number) => String(n).padStart(2, '0')
  return `${slug}-${savedOn.year}-${two(savedOn.month)}-${two(savedOn.day)}.estimate.json`
}

/** The text of a version-1 session file for `session`. A running live round
 *  (`submissions`, `revealed`, `round`) is left out: its estimates belong to
 *  participants of a session that won't exist when the file is loaded. */
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

/** An item as the file stores it, once its shape has been checked. */
type FileItem = Pick<Item, 'id' | 'title' | 'description' | 'notes' | 'finalResult'>

type FileShape = { version: number; sessionName: string; unit: string; items: FileItem[] }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFinalResult(value: unknown): value is AggregateResult | null {
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
    isFinalResult(value.finalResult)
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

/** The first rule item `index` (0-based) breaks, as a reason the user can act on. */
function itemProblem(item: FileItem, index: number): string | null {
  const label = `Item ${index + 1}`
  if (item.title.trim().length === 0) return `${label} has no title.`
  const result = item.finalResult
  if (result === null) return null
  if (result.min > result.max) {
    return `${label}, "${item.title}", has a range where the minimum is above the maximum.`
  }
  if (result.expected < result.min || result.expected > result.max) {
    return `${label}, "${item.title}", has an expected value outside its range.`
  }
  return null
}

/**
 * Reads a session file's text: the whole session, or the reason the file
 * can't be loaded — never a partly restored session.
 */
export function readSessionFile(text: string): Result<SavedSession> {
  const file = parse(text)
  if (!hasFileShape(file)) return { ok: false, error: NOT_A_SESSION_FILE }
  if (file.version > VERSION) {
    return { ok: false, error: 'This file was saved by a newer version of EstiMate.' }
  }
  if (file.version !== VERSION) return { ok: false, error: NOT_A_SESSION_FILE }
  const unit = file.unit
  if (!isEstimationUnit(unit)) {
    return { ok: false, error: `The unit "${unit}" isn't one EstiMate can estimate in.` }
  }
  for (const [index, item] of file.items.entries()) {
    const problem = itemProblem(item, index)
    if (problem !== null) return { ok: false, error: problem }
    const first = file.items.findIndex((other) => other.id === item.id)
    if (first !== index) {
      return {
        ok: false,
        error: `Item ${index + 1} has the same id as item ${first + 1}.`,
      }
    }
  }
  return {
    ok: true,
    value: {
      sessionName: file.sessionName,
      unit,
      items: file.items.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        notes: item.notes,
        finalResult: item.finalResult,
        submissions: [],
        revealed: false,
        round: 0,
      })),
    },
  }
}

/**
 * Whether `current` holds anything the last saved or loaded file
 * (`lastSaved`, as written by `writeSessionFile`) doesn't. Comparing whole
 * files makes every durable edit count and a running live round not. Before
 * any save or load, the baseline is a new session — no name, no items, the
 * default unit — so an untouched session has nothing to lose.
 */
export function hasUnsavedChanges(
  current: SavedSession,
  lastSaved: string | null,
): boolean {
  if (lastSaved === null) {
    return (
      current.sessionName.trim().length > 0 ||
      current.items.length > 0 ||
      current.unit !== DEFAULT_ESTIMATION_UNIT
    )
  }
  return writeSessionFile(current) !== lastSaved
}
