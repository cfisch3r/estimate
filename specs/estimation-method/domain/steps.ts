import { expect } from 'vitest'
import { Given, Then, When } from 'quickpickle'
import type { DataTable, QuickPickleWorld } from 'quickpickle'
import {
  aggregateEstimates,
  checkFalsePrecision,
  checkOutlier,
  checkSymmetricRange,
  createAggregateResult,
  createEstimate,
  isEstimationUnit,
  UNCERTAINTY_GUIDANCE,
  UNCERTAINTY_LEVELS,
  UNIT_GRANULARITY,
  uncertaintyGuidance,
  validateEstimateValues,
} from '../../../src/domain/estimate'
import type {
  AggregateResult,
  Estimate,
  EstimateValuesResult,
  EstimationUnit,
  Result,
  UncertaintyLevel,
} from '../../../src/domain/estimate'

/** What one scenario builds up step by step. */
type Data = {
  /** A final result made straight from its four values. */
  made?: Result<AggregateResult>
  /** One estimate made from its three values: the factory's verdict, and the
   *  validator's, which names the rule broken. */
  estimate?: { created: Result<Estimate>; values: EstimateValuesResult }
  estimates?: Estimate[]
  groupRange?: AggregateResult
  range?: { best: number; likely: number; worst: number }
  unit?: EstimationUnit
  value?: number
  level?: UncertaintyLevel
  best?: number
  worst?: number
}

function data(world: QuickPickleWorld): Data {
  return world.data as Data
}

function required<K extends keyof Data>(state: Data, key: K): NonNullable<Data[K]> {
  const value = state[key]
  if (value === undefined) throw new Error(`No ${key} yet — an earlier step must set it`)
  return value as NonNullable<Data[K]>
}

/** The single row of a one-row table, read as numbers by column name. */
function onlyRow(table: DataTable): (column: string) => number {
  const [row, ...rest] = table.hashes()
  if (!row || rest.length > 0) throw new Error('Give exactly one row of values')
  return (column) => {
    const text = row[column]
    if (text === undefined) throw new Error(`Missing column "${column}"`)
    return Number(text)
  }
}

/** "shows" / "does not show", "flagged" / "not flagged" and the like, as a boolean. */
function expectation(text: string, yes: string, no: string): boolean {
  if (text === yes) return true
  if (text === no) return false
  throw new Error(`Expected "${yes}" or "${no}", got "${text}"`)
}

// Final result

When('a final result is made of', (world: QuickPickleWorld, table: DataTable) => {
  const value = onlyRow(table)
  data(world).made = createAggregateResult({
    min: value('minimum'),
    expected: value('expected'),
    max: value('maximum'),
    ci90: value('90% value'),
  })
})

Then('the final result is accepted', (world: QuickPickleWorld) => {
  expect(required(data(world), 'made').ok).toBe(true)
})

Then(
  'the final result is rejected because it {}',
  (world: QuickPickleWorld, reason: string) => {
    expect(required(data(world), 'made')).toMatchObject({ ok: false, error: reason })
  },
)

// Estimate

/** The rule each reason in the spec names, as the validator's error code. */
const REJECTION_CODES: Record<string, string> = {
  "has a value that isn't a finite number": 'not-finite',
  'has a value above 1,000,000': 'too-large',
  'has a best case of 0 or less': 'non-positive',
  'has a best case above its likely case': 'best-above-likely',
  'has a likely case above its worst case': 'likely-above-worst',
}

When('an estimate is made of', (world: QuickPickleWorld, table: DataTable) => {
  const value = onlyRow(table)
  const [best, likely, worst] = [value('best'), value('likely'), value('worst')]
  data(world).estimate = {
    created: createEstimate({ participantId: 'participant', best, likely, worst }),
    values: validateEstimateValues(best, likely, worst),
  }
})

Then('the estimate is accepted', (world: QuickPickleWorld) => {
  expect(required(data(world), 'estimate').created.ok).toBe(true)
})

Then(
  'the estimate is rejected because it {}',
  (world: QuickPickleWorld, reason: string) => {
    const code = REJECTION_CODES[reason]
    if (code === undefined) throw new Error(`No rule is known for the reason "${reason}"`)
    const { created, values } = required(data(world), 'estimate')
    expect(created.ok).toBe(false)
    expect(values).toMatchObject({ ok: false, code })
  },
)

// Aggregation

Given('the estimates', (world: QuickPickleWorld, table: DataTable) => {
  data(world).estimates = table.hashes().map((row) => {
    const created = createEstimate({
      participantId: row['participant'] ?? '',
      best: Number(row['best']),
      likely: Number(row['likely']),
      worst: Number(row['worst']),
    })
    if (!created.ok) throw new Error(`Not a valid estimate: ${created.error}`)
    return created.value
  })
})

When('they are aggregated', (world: QuickPickleWorld) => {
  data(world).groupRange = aggregateEstimates(required(data(world), 'estimates'))
})

Then('the group range is', (world: QuickPickleWorld, table: DataTable) => {
  const value = onlyRow(table)
  expect(required(data(world), 'groupRange')).toMatchObject({
    min: value('minimum'),
    expected: value('expected'),
    max: value('maximum'),
  })
})

Then('the group range is a valid final result', (world: QuickPickleWorld) => {
  expect(createAggregateResult(required(data(world), 'groupRange')).ok).toBe(true)
})

Then('the 90% value is {float}', (world: QuickPickleWorld, ci90: number) => {
  expect(required(data(world), 'groupRange').ci90).toBeCloseTo(ci90, 2)
})

// Symmetric range

When(
  'the range {float} \\/ {float} \\/ {float} is entered',
  (world: QuickPickleWorld, best: number, likely: number, worst: number) => {
    data(world).range = { best, likely, worst }
  },
)

Then('the symmetric-range nudge {}', (world: QuickPickleWorld, nudge: string) => {
  const { best, likely, worst } = required(data(world), 'range')
  expect(checkSymmetricRange(best, likely, worst).fired).toBe(
    expectation(nudge, 'shows', 'does not show'),
  )
})

// False precision

Given('the session is estimated in {word}', (world: QuickPickleWorld, unit: string) => {
  if (!isEstimationUnit(unit)) throw new Error(`"${unit}" is not an estimation unit`)
  data(world).unit = unit
})

When('the value {float} is entered', (world: QuickPickleWorld, value: number) => {
  data(world).value = value
})

Then('the rounding suggestion {}', (world: QuickPickleWorld, suggestion: string) => {
  const state = data(world)
  const granularity = UNIT_GRANULARITY[required(state, 'unit')]
  expect(checkFalsePrecision(required(state, 'value'), granularity).fired).toBe(
    expectation(suggestion, 'shows', 'does not show'),
  )
})

// Uncertainty range

Given('the phase {string}', (world: QuickPickleWorld, label: string) => {
  const level = UNCERTAINTY_LEVELS.find((l) => UNCERTAINTY_GUIDANCE[l].label === label)
  if (level === undefined) throw new Error(`No phase is labelled "${label}"`)
  data(world).level = level
})

When('the best case {float} is entered', (world: QuickPickleWorld, best: number) => {
  data(world).best = best
})

When(
  'the range {float} to {float} is entered',
  (world: QuickPickleWorld, best: number, worst: number) => {
    Object.assign(data(world), { best, worst })
  },
)

/** The ceiling as the app computes it, so "exactly at" isn't lost to rounding. */
function guidanceCeiling(state: Data): number {
  const best = required(state, 'best')
  const guidance = uncertaintyGuidance(best, best, required(state, 'level'))
  if (guidance === null) throw new Error(`No guidance for a best case of ${best}`)
  return guidance.guidanceHigh
}

When(
  'the range {float} to the guidance ceiling is entered',
  (world: QuickPickleWorld, best: number) => {
    const state = data(world)
    state.best = best
    state.worst = guidanceCeiling(state)
  },
)

Then('the guidance ceiling is {float}', (world: QuickPickleWorld, ceiling: number) => {
  expect(guidanceCeiling(data(world))).toBeCloseTo(ceiling, 2)
})

Then('the range gets {}', (world: QuickPickleWorld, response: string) => {
  const state = data(world)
  const guidance = uncertaintyGuidance(
    required(state, 'best'),
    required(state, 'worst'),
    required(state, 'level'),
  )
  const nudged = expectation(response, 'the narrow-range nudge', 'a calm confirmation')
  expect(guidance).toMatchObject({ covered: !nudged, guard: { fired: nudged } })
})

// Outlier

When('they are compared with each other', () => {
  // The comparison runs per participant in the Then steps; nothing to prepare.
})

function isFlagged(world: QuickPickleWorld, participant: string): boolean {
  const estimates = required(data(world), 'estimates')
  const estimate = estimates.find((e) => e.participantId === participant)
  if (estimate === undefined) throw new Error(`${participant} has no estimate`)
  return checkOutlier(estimate, estimates).fired
}

Then('{word} is flagged', (world: QuickPickleWorld, participant: string) => {
  expect(isFlagged(world, participant)).toBe(true)
})

Then('{word} is not flagged', (world: QuickPickleWorld, participant: string) => {
  expect(isFlagged(world, participant)).toBe(false)
})
