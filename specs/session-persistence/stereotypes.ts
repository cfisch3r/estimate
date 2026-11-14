/**
 * Stereotypes for hand-written session files: valid defaults that a step
 * names by domain state ("an estimated item") and overrides only where the
 * scenario depends on a value. They build the plain version-1 JSON a user's
 * file would hold, without importing `src/` (the `specs-concept-no-src-import`
 * rule), so any Test Level of this concept can use them; today the e2e steps
 * do. The domain spec writes its base file out in the `.feature` instead,
 * because there the format itself is under test.
 */

/** A finalized item's result, as the version-1 file stores it. */
export type FinalResultV1 = { min: number; expected: number; max: number; ci90: number }

export type ItemV1 = {
  id: string
  title: string
  description: string
  notes: string
  finalResult: FinalResultV1 | null
}

export type SessionFileV1 = {
  version: 1
  sessionName: string
  unit: 'days'
  items: ItemV1[]
}

let nextItemId = 1

/** An item nobody has estimated yet. */
export function anUnestimatedItem(
  title: string,
  overrides: Partial<ItemV1> = {},
): ItemV1 {
  return {
    id: `item-${nextItemId++}`,
    title,
    description: '',
    notes: '',
    finalResult: null,
    ...overrides,
  }
}

/** A valid final result: min ≤ expected ≤ max. */
function aFinalResult(overrides: Partial<FinalResultV1> = {}): FinalResultV1 {
  const { min = 2, expected = 3, max = 6 } = overrides
  // The app rejects a 90% value that isn't McConnell's for the range, so the
  // default follows the formula (repeated here: specs may not import src/).
  const ci90 = expected + (1.28 * (max - min)) / 3
  return { min, expected, max, ci90, ...overrides }
}

/** An item with a finalized estimate. */
export function anEstimatedItem(
  title: string,
  finalResult: Partial<FinalResultV1> = {},
): ItemV1 {
  return anUnestimatedItem(title, { finalResult: aFinalResult(finalResult) })
}

/** A valid session file holding `items`. */
export function aSessionFile(
  items: ItemV1[],
  overrides: Partial<Omit<SessionFileV1, 'items'>> = {},
): SessionFileV1 {
  return { version: 1, sessionName: 'Saved session', unit: 'days', items, ...overrides }
}
