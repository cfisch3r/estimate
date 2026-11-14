import { expect } from 'vitest'
import { Given, When, Then } from 'quickpickle'
import type { DataTable, QuickPickleWorld } from 'quickpickle'
import type { AggregateResult, EstimationUnit } from '../../../src/domain/estimate'
import type { Item } from '../../../src/domain/types'
import {
  readSessionFile,
  sessionFileName,
  writeSessionFile,
} from '../../../src/domain/sessionFile'
import type { SavedSession } from '../../../src/domain/sessionFile'
import { estimateOf, finalizedItemOf, itemOf } from '../../../src/domain/testFixtures'
import type { Result } from '../../../src/domain/estimate'

/** What one scenario builds up step by step. */
type Data = {
  sessionName?: string
  fileName?: string
  /** The file a "read" step reads, as text. */
  fileText?: string
  /** Each source item's final result by title, so "estimated" can be checked
   *  against what went in rather than just "not null". */
  sourceResults?: Map<string, AggregateResult | null>
  /** The session a "saved and read back" step saves. */
  session?: SavedSession
  read?: Result<SavedSession>
}

function data(world: QuickPickleWorld): Data {
  return world.data as Data
}

function required<K extends keyof Data>(state: Data, key: K): NonNullable<Data[K]> {
  const value = state[key]
  if (value === undefined) throw new Error(`No ${key} yet — an earlier step must set it`)
  return value as NonNullable<Data[K]>
}

/** Remembers each item's final result from the plain JSON a file holds. */
function rememberSourceResults(state: Data, json: unknown): void {
  const items = (
    json as { items?: { title: string; finalResult: AggregateResult | null }[] }
  ).items
  state.sourceResults = new Map(
    (items ?? []).map((item) => [item.title, item.finalResult]),
  )
}

/** Sets the value at a path like `items[0].finalResult.min` in plain JSON. */
function setAtPath(json: unknown, path: string, value: unknown): void {
  const keys = path.match(/[^.[\]]+/g) ?? []
  const last = keys.pop()
  if (last === undefined) throw new Error(`Not a field path: ${path}`)
  let target = json as Record<string, unknown>
  for (const key of keys) target = target[key] as Record<string, unknown>
  target[last] = value
}

// --- File name ------------------------------------------------------------

Given('a session named {string}', (world: QuickPickleWorld, sessionName: string) => {
  data(world).sessionName = sessionName
})

When('it is saved on {word}', (world: QuickPickleWorld, date: string) => {
  const state = data(world)
  const [year, month, day] = date.split('-').map(Number)
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error(`Not a date like 2026-11-12: ${date}`)
  }
  state.fileName = sessionFileName(required(state, 'sessionName'), { year, month, day })
})

Then('the file is named {string}', (world: QuickPickleWorld, fileName: string) => {
  expect(data(world).fileName).toBe(fileName)
})

// --- Reading a file -------------------------------------------------------

Given('the file', (world: QuickPickleWorld, text: string) => {
  const state = data(world)
  state.fileText = text
  rememberSourceResults(state, JSON.parse(text))
})

Given('the file contains {}', (world: QuickPickleWorld, text: string) => {
  data(world).fileText = text
})

/** Changes one field of the file the Background gave, so each rule break
 *  is one visible change to an otherwise valid file. */
Given('its {word} is {}', (world: QuickPickleWorld, path: string, value: string) => {
  const state = data(world)
  const json: unknown = JSON.parse(required(state, 'fileText'))
  setAtPath(json, path, JSON.parse(value))
  state.fileText = JSON.stringify(json)
})

Given(
  'a session named {string} estimated in {word} with the items',
  (world: QuickPickleWorld, sessionName: string, unit: string, table: DataTable) => {
    const items: Item[] = table.hashes().map((row, index) => {
      const base = { id: `item-${index + 1}`, title: row.item ?? '' }
      if (row.state === 'estimated') return finalizedItemOf(base)
      if (row.state === 'in a running round') {
        return itemOf({
          ...base,
          submissions: [estimateOf('p1'), estimateOf('p2')],
          revealed: true,
          round: 2,
        })
      }
      throw new Error(
        `Unknown item state "${row.state}" — use estimated / in a running round`,
      )
    })
    const state = data(world)
    state.session = { sessionName, unit: unit as EstimationUnit, items }
    state.sourceResults = new Map(items.map((item) => [item.title, item.finalResult]))
  },
)

When('it is read', (world: QuickPickleWorld) => {
  const state = data(world)
  state.read = readSessionFile(required(state, 'fileText'))
})

When('it is saved and read back', (world: QuickPickleWorld) => {
  const state = data(world)
  state.read = readSessionFile(writeSessionFile(required(state, 'session')))
})

function readSession(state: Data): SavedSession {
  const read = required(state, 'read')
  if (!read.ok) throw new Error(`The file was rejected: ${read.error}`)
  return read.value
}

Then(
  'the session is named {string} and estimated in {word}',
  (world: QuickPickleWorld, sessionName: string, unit: string) => {
    const session = readSession(data(world))
    expect(session.sessionName).toBe(sessionName)
    expect(session.unit).toBe(unit)
  },
)

Then('it has the items', (world: QuickPickleWorld, table: DataTable) => {
  const state = data(world)
  const session = readSession(state)
  const rows = table.hashes()
  expect(session.items.map((item) => item.title)).toEqual(rows.map((row) => row.item))
  rows.forEach((row, index) => {
    const item = session.items[index]
    // Every read item starts outside any live round.
    expect(item).toMatchObject({ submissions: [], revealed: false, round: 0 })
    if (row.state === 'estimated') {
      expect(item?.finalResult).toEqual(state.sourceResults?.get(row.item ?? ''))
    } else if (row.state === 'not estimated') {
      expect(item?.finalResult).toBeNull()
    } else {
      throw new Error(`Unknown item state "${row.state}" — use estimated / not estimated`)
    }
  })
})

Then('it is rejected with the reason: {}', (world: QuickPickleWorld, reason: string) => {
  const read = required(data(world), 'read')
  expect(read).toEqual({ ok: false, error: reason })
})
