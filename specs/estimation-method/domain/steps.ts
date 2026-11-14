import { expect } from 'vitest'
import { Then, When } from 'quickpickle'
import type { DataTable, QuickPickleWorld } from 'quickpickle'
import { createAggregateResult } from '../../../src/domain/estimate'
import type { AggregateResult, Result } from '../../../src/domain/estimate'

/** What one scenario builds up step by step. */
type Data = { made?: Result<AggregateResult> }

function data(world: QuickPickleWorld): Data {
  return world.data as Data
}

function made(world: QuickPickleWorld): Result<AggregateResult> {
  const result = data(world).made
  if (result === undefined)
    throw new Error('No final result yet — "a final result is made of" must run first')
  return result
}

When('a final result is made of', (world: QuickPickleWorld, table: DataTable) => {
  const [row, ...rest] = table.hashes()
  if (!row || rest.length > 0) throw new Error('Give exactly one row of values')
  const value = (column: string) => {
    const text = row[column]
    if (text === undefined) throw new Error(`Missing column "${column}"`)
    return Number(text)
  }
  data(world).made = createAggregateResult({
    min: value('minimum'),
    expected: value('expected'),
    max: value('maximum'),
    ci90: value('90% value'),
  })
})

Then('the final result is accepted', (world: QuickPickleWorld) => {
  expect(made(world).ok).toBe(true)
})

Then(
  'the final result is rejected because it {}',
  (world: QuickPickleWorld, reason: string) => {
    expect(made(world)).toMatchObject({ ok: false, error: reason })
  },
)
