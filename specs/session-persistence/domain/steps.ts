import { expect } from 'vitest'
import { Given, When, Then } from 'quickpickle'
import type { DataTable, QuickPickleWorld } from 'quickpickle'
import { DEFAULT_ESTIMATION_UNIT } from '../../../src/domain/estimate'
import type {
  AggregateResult,
  AggregateValues,
  EstimationUnit,
  Result,
} from '../../../src/domain/estimate'
import {
  appendItem,
  moveItem,
  removeItemFrom,
  updateItem,
} from '../../../src/domain/item'
import {
  createSavedSession,
  hasUnsavedChanges,
  restoredItems,
  savedSessionOf,
} from '../../../src/domain/savedSession'
import type {
  SavedSession,
  SavedSessionError,
  SavedSessionInput,
  SessionContent,
} from '../../../src/domain/savedSession'
import { aggregateOf, estimateOf, itemOf } from '../../../src/domain/testFixtures'
import type { Item } from '../../../src/domain/types'

/** What one scenario builds up step by step. */
type Data = {
  /** The session as the user holds it. */
  session?: SessionContent
  /** The last save or load: what "unsaved" compares against. Null for a new
   *  session that was never saved or loaded. */
  baseline?: SavedSession | null
  /** What the last save kept. */
  saved?: SavedSession
  /** A saved session's plain values, before its rules are checked. */
  input?: SavedSessionInput
  /** The session a restore gave back, or why it was refused. */
  restored?: Result<SessionContent, SavedSessionError>
}

function data(world: QuickPickleWorld): Data {
  return world.data as Data
}

function required<K extends keyof Data>(state: Data, key: K): NonNullable<Data[K]> {
  const value = state[key]
  if (value === undefined || value === null) {
    throw new Error(`No ${key} yet — an earlier step must set it`)
  }
  return value as NonNullable<Data[K]>
}

/** The final result every "estimated" item has: a consistent one, the same
 *  values estimation-method/domain/final-result.feature accepts. */
const FINAL_VALUES: AggregateValues = { min: 3, expected: 5.8, max: 12, ci90: 9.64 }

function itemWithState(base: Partial<Item>, state: string | undefined): Item {
  if (state === 'estimated')
    return itemOf({ ...base, finalResult: aggregateOf(3, 5.8, 12) })
  if (state === 'not estimated') return itemOf(base)
  if (state === 'in a running round') {
    return itemOf({
      ...base,
      submissions: [estimateOf('p1'), estimateOf('p2')],
      revealed: true,
      round: 2,
    })
  }
  throw new Error(
    `Unknown item state "${state}" — use estimated / not estimated / in a running round`,
  )
}

function idOf(session: SessionContent, title: string): string {
  const item = session.items.find((candidate) => candidate.title === title)
  if (!item) throw new Error(`The session has no item "${title}"`)
  return item.id
}

/** Changes the session the way the user's edits do, through the domain's own
 *  item functions. */
function edit(
  world: QuickPickleWorld,
  change: (session: SessionContent) => SessionContent,
) {
  const state = data(world)
  state.session = change(required(state, 'session'))
}

function save(state: Data): void {
  const saved = savedSessionOf(required(state, 'session'))
  state.saved = saved
  state.baseline = saved
}

/** Each item's final result, checked against the state a table row names. */
function expectItems(items: (Item | SavedSession['items'][number])[], table: DataTable) {
  const rows = table.hashes()
  expect(items.map((item) => item.title)).toEqual(rows.map((row) => row.item))
  rows.forEach((row, index) => {
    const finalResult = items[index]?.finalResult
    if (row.state === 'estimated') expect(finalResult).toEqual(aggregateOf(3, 5.8, 12))
    else if (row.state === 'not estimated') expect(finalResult).toBeNull()
    else
      throw new Error(`Unknown item state "${row.state}" — use estimated / not estimated`)
  })
}

// --- The session --------------------------------------------------------------

Given(
  'a session named {string} estimated in {word} with the items',
  (world: QuickPickleWorld, sessionName: string, unit: string, table: DataTable) => {
    const items = table
      .hashes()
      .map((row, index) =>
        itemWithState(
          { id: row.id ?? `item-${index + 1}`, title: row.item ?? '' },
          row.state,
        ),
      )
    const state = data(world)
    state.session = { sessionName, unit: unit as EstimationUnit, items }
    state.baseline = null
  },
)

Given(
  'a session with the item {string} described as {string} with the notes {string}',
  (world: QuickPickleWorld, title: string, description: string, notes: string) => {
    const state = data(world)
    state.session = {
      sessionName: '',
      unit: DEFAULT_ESTIMATION_UNIT,
      items: [itemOf({ id: 'item-1', title, description, notes })],
    }
    state.baseline = null
  },
)

Given('a new session', (world: QuickPickleWorld) => {
  const state = data(world)
  state.session = { sessionName: '', unit: DEFAULT_ESTIMATION_UNIT, items: [] }
  state.baseline = null
})

// --- Saving and loading ---------------------------------------------------------

When('it is saved', (world: QuickPickleWorld) => {
  save(data(world))
})

Given('it has just been saved', (world: QuickPickleWorld) => {
  save(data(world))
})

When('it is saved and restored', (world: QuickPickleWorld) => {
  const state = data(world)
  save(state)
  const saved = required(state, 'saved')
  state.restored = { ok: true, value: { ...saved, items: restoredItems(saved) } }
})

/** Loading puts the restored items in the session and makes what was loaded
 *  the baseline, as the store's `loadSession` does. */
When('it is saved and then loaded', (world: QuickPickleWorld) => {
  const state = data(world)
  const saved = savedSessionOf(required(state, 'session'))
  state.session = {
    sessionName: saved.sessionName,
    unit: saved.unit,
    items: restoredItems(saved),
  }
  state.baseline = saved
})

Then(
  'the saved session is named {string} and estimated in {word}',
  (world: QuickPickleWorld, sessionName: string, unit: string) => {
    const saved = required(data(world), 'saved')
    expect(saved.sessionName).toBe(sessionName)
    expect(saved.unit).toBe(unit)
  },
)

Then('it keeps the items', (world: QuickPickleWorld, table: DataTable) => {
  const saved = required(data(world), 'saved')
  expectItems(saved.items, table)
  // A saved item has no place for a running round at all.
  for (const item of saved.items) {
    expect(Object.keys(item).sort()).toEqual([
      'description',
      'finalResult',
      'id',
      'notes',
      'title',
    ])
  }
})

// --- Restoring a saved session ------------------------------------------------

Given(
  'a saved session named {string} estimated in {word} with the items',
  (world: QuickPickleWorld, sessionName: string, unit: string, table: DataTable) => {
    data(world).input = {
      sessionName,
      unit,
      items: table.hashes().map((row, index) => ({
        id: row.id ?? `item-${index + 1}`,
        title: row.item ?? '',
        description: '',
        notes: '',
        finalResult: row.state === 'estimated' ? { ...FINAL_VALUES } : null,
      })),
    }
  },
)

function inputItem(world: QuickPickleWorld, position: number) {
  const item = required(data(world), 'input').items[position - 1]
  if (!item) throw new Error(`The saved session has no item ${position}`)
  return item
}

function inputFinalResult(world: QuickPickleWorld, position: number): AggregateValues {
  const { finalResult } = inputItem(world, position)
  if (!finalResult) throw new Error(`Item ${position} has no final result to change`)
  return finalResult
}

Given('its unit is {string}', (world: QuickPickleWorld, unit: string) => {
  required(data(world), 'input').unit = unit
})

Given(
  "item {int}'s id is {string}",
  (world: QuickPickleWorld, position: number, id: string) => {
    inputItem(world, position).id = id
  },
)

Given(
  "item {int}'s title is {string}",
  (world: QuickPickleWorld, position: number, title: string) => {
    inputItem(world, position).title = title
  },
)

Given(
  "item {int}'s final result minimum is {float}",
  (world: QuickPickleWorld, position: number, min: number) => {
    inputFinalResult(world, position).min = min
  },
)

Given(
  "item {int}'s final result 90% value is {float}",
  (world: QuickPickleWorld, position: number, ci90: number) => {
    inputFinalResult(world, position).ci90 = ci90
  },
)

When('it is restored', (world: QuickPickleWorld) => {
  const state = data(world)
  const result = createSavedSession(required(state, 'input'))
  state.restored = result.ok
    ? { ok: true, value: { ...result.value, items: restoredItems(result.value) } }
    : result
})

function restoredSession(state: Data): SessionContent {
  const restored = required(state, 'restored')
  if (!restored.ok) {
    throw new Error(`The saved session was refused: ${JSON.stringify(restored.error)}`)
  }
  return restored.value
}

Then(
  'the session is named {string} and estimated in {word}',
  (world: QuickPickleWorld, sessionName: string, unit: string) => {
    const session = restoredSession(data(world))
    expect(session.sessionName).toBe(sessionName)
    expect(session.unit).toBe(unit)
  },
)

Then('it has the items', (world: QuickPickleWorld, table: DataTable) => {
  expectItems(restoredSession(data(world)).items, table)
})

Then('no item is in a running round', (world: QuickPickleWorld) => {
  for (const item of restoredSession(data(world)).items) {
    expect(item).toMatchObject({ submissions: [], revealed: false, round: 0 })
  }
})

Then(
  'the item {string} is described as {string} with the notes {string}',
  (world: QuickPickleWorld, title: string, description: string, notes: string) => {
    const item = restoredSession(data(world)).items.find((each) => each.title === title)
    expect(item).toMatchObject({ description, notes })
  },
)

/** The refusal a reason in the feature's own words stands for. */
function refusalFor(reason: string): SavedSessionError {
  const unit = /^the unit "(.*)" isn't one EstiMate estimates in$/.exec(reason)
  if (unit) return { code: 'unknown-unit', unit: unit[1] ?? '' }
  const noId = /^item (\d+) has no id$/.exec(reason)
  if (noId) return { code: 'item-without-id', position: Number(noId[1]) }
  const noTitle = /^item (\d+) has no title$/.exec(reason)
  if (noTitle) return { code: 'item-without-title', position: Number(noTitle[1]) }
  const duplicate = /^item (\d+) has the same id as item (\d+)$/.exec(reason)
  if (duplicate) {
    return {
      code: 'duplicate-item-id',
      position: Number(duplicate[1]),
      samePositionAs: Number(duplicate[2]),
    }
  }
  const broken = /^item (\d+), "(.*)", (.*)$/.exec(reason)
  if (broken) {
    return {
      code: 'broken-final-result',
      position: Number(broken[1]),
      title: broken[2] ?? '',
      reason: broken[3] ?? '',
    }
  }
  throw new Error(`No refusal is known for the reason "${reason}"`)
}

Then('it is refused because {}', (world: QuickPickleWorld, reason: string) => {
  expect(required(data(world), 'restored')).toEqual({
    ok: false,
    error: refusalFor(reason),
  })
})

// --- What counts as unsaved -----------------------------------------------------

When('it is named {string}', (world: QuickPickleWorld, sessionName: string) => {
  edit(world, (session) => ({ ...session, sessionName }))
})

When('its unit becomes {word}', (world: QuickPickleWorld, unit: string) => {
  edit(world, (session) => ({ ...session, unit: unit as EstimationUnit }))
})

When('the item {string} is added', (world: QuickPickleWorld, title: string) => {
  edit(world, (session) => {
    const added = appendItem(
      { items: session.items, activeItemId: null },
      { id: `added-${session.items.length + 1}`, title, description: '' },
    )
    if (!added) throw new Error(`"${title}" is no title an item can have`)
    return { ...session, items: added.items }
  })
})

When('the item {string} is removed', (world: QuickPickleWorld, title: string) => {
  edit(world, (session) => ({
    ...session,
    items: removeItemFrom(
      { items: session.items, activeItemId: null },
      idOf(session, title),
    ).items,
  }))
})

When(
  'the item {string} is moved before {string}',
  (world: QuickPickleWorld, title: string, before: string) => {
    edit(world, (session) => {
      const titles = session.items.map((item) => item.title)
      const moved = moveItem(session.items, titles.indexOf(title), titles.indexOf(before))
      if (!moved) throw new Error(`The session has no item "${title}"`)
      return { ...session, items: moved }
    })
  },
)

When(
  'the item {string} is retitled {string}',
  (world: QuickPickleWorld, title: string, newTitle: string) => {
    edit(world, (session) => ({
      ...session,
      items: updateItem(session.items, idOf(session, title), { title: newTitle }),
    }))
  },
)

When(
  'the item {string} gets the description {string}',
  (world: QuickPickleWorld, title: string, description: string) => {
    edit(world, (session) => ({
      ...session,
      items: updateItem(session.items, idOf(session, title), { description }),
    }))
  },
)

When(
  'the item {string} gets the notes {string}',
  (world: QuickPickleWorld, title: string, notes: string) => {
    edit(world, (session) => ({
      ...session,
      items: updateItem(session.items, idOf(session, title), { notes }),
    }))
  },
)

When('the item {string} is finalized', (world: QuickPickleWorld, title: string) => {
  const finalResult: AggregateResult = aggregateOf(2, 4, 9)
  edit(world, (session) => ({
    ...session,
    items: updateItem(session.items, idOf(session, title), { finalResult }),
  }))
})

When(
  'a round on {string} starts and collects an estimate',
  (world: QuickPickleWorld, title: string) => {
    edit(world, (session) => ({
      ...session,
      items: updateItem(session.items, idOf(session, title), {
        round: 1,
        submissions: [estimateOf('p1')],
      }),
    }))
  },
)

Then('it has unsaved changes', (world: QuickPickleWorld) => {
  const state = data(world)
  expect(hasUnsavedChanges(required(state, 'session'), state.baseline ?? null)).toBe(true)
})

Then('it has no unsaved changes', (world: QuickPickleWorld) => {
  const state = data(world)
  expect(hasUnsavedChanges(required(state, 'session'), state.baseline ?? null)).toBe(
    false,
  )
})
