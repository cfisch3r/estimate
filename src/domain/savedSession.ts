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

// Placeholders until #246 is implemented: the failing specs call them.
function notImplemented(): never {
  throw new Error('Not implemented yet (#246)')
}

export const createSavedSession: (
  input: SavedSessionInput,
) => Result<SavedSession, SavedSessionError> = notImplemented

export const savedSessionOf: (session: SessionContent) => SavedSession = notImplemented

export const restoredItems: (saved: SavedSession) => Item[] = notImplemented

export const hasUnsavedChanges: (
  current: SessionContent,
  baseline: SavedSession | null,
) => boolean = notImplemented
