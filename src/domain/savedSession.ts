import {
  createAggregateResult,
  DEFAULT_ESTIMATION_UNIT,
  isEstimationUnit,
} from './estimate'
import type { AggregateResult, AggregateValues, EstimationUnit, Result } from './estimate'
import type { Item } from './types'

/** An item as a saved session keeps it: everything but a running round. */
export type SavedItem = Pick<Item, 'id' | 'title' | 'description' | 'notes'> & {
  finalResult: AggregateResult | null
}

declare const SavedSessionBrand: unique symbol

/** The part of a session that outlives its browser tab: its name, its unit and
 *  its items without any running round. Only producible through
 *  `createSavedSession()` (untrusted input, such as a file) or
 *  `savedSessionOf()` (the session itself), so its rules hold wherever one is
 *  handed around. The brand is compile-time only: a saved session stays plain
 *  data. */
export type SavedSession = {
  sessionName: string
  unit: EstimationUnit
  items: SavedItem[]
} & { readonly [SavedSessionBrand]: true }

/** What a reader hands `createSavedSession()` once its input has the right
 *  shape: plain values whose rules haven't been checked yet. */
export type SavedSessionInput = {
  sessionName: string
  unit: string
  items: (Pick<Item, 'id' | 'title' | 'description' | 'notes'> & {
    finalResult: AggregateValues | null
  })[]
}

/** The first rule a saved session's input breaks. `position` counts items from
 *  1, as the user does. Carries no text. */
export type SavedSessionError =
  | { code: 'unknown-unit'; unit: string }
  | { code: 'item-without-id'; position: number }
  | { code: 'item-without-title'; position: number }
  | { code: 'duplicate-item-id'; position: number; samePositionAs: number }
  | { code: 'broken-final-result'; position: number; title: string; reason: string }

/** The session fields a save keeps, as the session holds them. */
export type SessionContent = { sessionName: string; unit: EstimationUnit; items: Item[] }

type ItemInput = SavedSessionInput['items'][number]

/** Item `position` (counted from 1) as a saved session keeps it, or the first
 *  rule it breaks. Its final result goes through the one factory every final
 *  result goes through. */
function savedItemOf(
  item: ItemInput,
  position: number,
): Result<SavedItem, SavedSessionError> {
  // A blank id would mean "no item" to a live session's messages.
  if (item.id.trim().length === 0) {
    return { ok: false, error: { code: 'item-without-id', position } }
  }
  if (item.title.trim().length === 0) {
    return { ok: false, error: { code: 'item-without-title', position } }
  }
  let finalResult: AggregateResult | null = null
  if (item.finalResult !== null) {
    const result = createAggregateResult(item.finalResult)
    if (!result.ok) {
      return {
        ok: false,
        error: {
          code: 'broken-final-result',
          position,
          title: item.title,
          reason: result.error,
        },
      }
    }
    finalResult = result.value
  }
  const { id, title, description, notes } = item
  return { ok: true, value: { id, title, description, notes, finalResult } }
}

/**
 * The saved session `input` describes, or the first rule it breaks: never a
 * partly restored session. Every saved session read from outside the
 * application, such as a file, becomes one only through here.
 */
export function createSavedSession(
  input: SavedSessionInput,
): Result<SavedSession, SavedSessionError> {
  const { unit } = input
  if (!isEstimationUnit(unit)) return { ok: false, error: { code: 'unknown-unit', unit } }
  const items: SavedItem[] = []
  const firstPositionOf = new Map<string, number>()
  for (const [index, item] of input.items.entries()) {
    const position = index + 1
    const saved = savedItemOf(item, position)
    if (!saved.ok) return saved
    const first = firstPositionOf.get(item.id)
    if (first !== undefined) {
      return {
        ok: false,
        error: { code: 'duplicate-item-id', position, samePositionAs: first },
      }
    }
    firstPositionOf.set(item.id, position)
    items.push(saved.value)
  }
  return {
    ok: true,
    value: { sessionName: input.sessionName, unit, items } as SavedSession,
  }
}

/** What a save keeps of `session`: everything but a running live round, whose
 *  estimates belong to participants of a session that won't exist when it is
 *  restored. The session's own items already keep every rule. */
export function savedSessionOf(session: SessionContent): SavedSession {
  return {
    sessionName: session.sessionName,
    unit: session.unit,
    items: session.items.map(({ id, title, description, notes, finalResult }) => ({
      id,
      title,
      description,
      notes,
      finalResult,
    })),
  } as SavedSession
}

/** The items of a restored session: each one outside any live round. */
export function restoredItems(saved: SavedSession): Item[] {
  return saved.items.map((item) => ({
    ...item,
    submissions: [],
    revealed: false,
    round: 0,
  }))
}

function sameFinalResult(a: AggregateResult | null, b: AggregateResult | null): boolean {
  if (a === null || b === null) return a === b
  return (
    a.min === b.min && a.expected === b.expected && a.max === b.max && a.ci90 === b.ci90
  )
}

function sameItem(a: SavedItem, b: SavedItem): boolean {
  return (
    a.id === b.id &&
    a.title === b.title &&
    a.description === b.description &&
    a.notes === b.notes &&
    sameFinalResult(a.finalResult, b.finalResult)
  )
}

/**
 * Whether `current` holds anything the last save or load (`baseline`) doesn't:
 * its saved session compared field by field, so every durable edit counts, an
 * edit that is undone doesn't, and a running live round never does. Before any
 * save or load the baseline is a new session (no name, no items, the default
 * unit), so an untouched session has nothing to lose.
 */
export function hasUnsavedChanges(
  current: SessionContent,
  baseline: SavedSession | null,
): boolean {
  if (baseline === null) {
    return (
      current.sessionName.trim().length > 0 ||
      current.items.length > 0 ||
      current.unit !== DEFAULT_ESTIMATION_UNIT
    )
  }
  const saved = savedSessionOf(current)
  return !(
    saved.sessionName === baseline.sessionName &&
    saved.unit === baseline.unit &&
    saved.items.length === baseline.items.length &&
    saved.items.every((item, index) => {
      const other = baseline.items[index]
      return other !== undefined && sameItem(item, other)
    })
  )
}
