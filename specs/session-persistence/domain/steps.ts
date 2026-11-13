import { expect } from 'vitest'
import { Given, When, Then } from 'quickpickle'
import type { QuickPickleWorld } from 'quickpickle'
import { sessionFileName } from '../../../src/domain/sessionFile'

/** What one scenario builds up step by step. */
type Data = {
  sessionName?: string
  fileName?: string
}

function data(world: QuickPickleWorld): Data {
  return world.data as Data
}

Given('a session named {string}', (world: QuickPickleWorld, sessionName: string) => {
  data(world).sessionName = sessionName
})

When('it is saved on {word}', (world: QuickPickleWorld, date: string) => {
  const state = data(world)
  if (state.sessionName === undefined) {
    throw new Error('No session name — "a session named …" must run first')
  }
  const [year, month, day] = date.split('-').map(Number)
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error(`Not a date like 2026-11-12: ${date}`)
  }
  state.fileName = sessionFileName(state.sessionName, { year, month, day })
})

Then('the file is named {string}', (world: QuickPickleWorld, fileName: string) => {
  expect(data(world).fileName).toBe(fileName)
})
