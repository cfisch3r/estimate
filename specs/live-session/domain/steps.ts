import { expect } from 'vitest'
import { Given, Then, When } from 'quickpickle'
import type { DataTable, QuickPickleWorld } from 'quickpickle'
import {
  deriveConnectionStatus,
  facilitatorStart,
  holdsItemList,
  leaveConfirmation,
  participantJoin,
  withConnectionStatus,
} from '../../../src/domain/connection'
import type { ConnectionEntry, LeaveConfirmation } from '../../../src/domain/connection'
import { deliveryStateFor } from '../../../src/domain/delivery'
import { aggregateEstimates } from '../../../src/domain/estimate'
import type { ActionResult, Estimate, EstimationUnit } from '../../../src/domain/estimate'
import { finalResultFor } from '../../../src/domain/finalResult'
import {
  appendItem,
  livePhaseOf,
  moveItem,
  removeItemFrom,
  renameItem,
} from '../../../src/domain/item'
import type { ItemList } from '../../../src/domain/item'
import { advanceFrom, previousItemId } from '../../../src/domain/navigation'
import { participantLabels } from '../../../src/domain/participantLabel'
import { FACILITATOR_PARTICIPANT_ID } from '../../../src/domain/participantId'
import { needsResend } from '../../../src/domain/resend'
import { shouldPruneDeparted } from '../../../src/domain/roster'
import {
  acceptRemoteEstimate,
  adoptSnapshot,
  canFinalizeLive,
  recordOwnSubmission,
  retryRoundPatch,
} from '../../../src/domain/round'
import {
  buildSessionSnapshot,
  sessionFieldsFromSnapshot,
} from '../../../src/domain/snapshot'
import { aggregateOf, estimateOf, itemOf } from '../../../src/domain/testFixtures'
import type {
  ConnectionStatus,
  Item,
  LiveConnectionStatus,
  LiveRound,
  RosterEntry,
  SessionSnapshot,
} from '../../../src/domain/types'

// ---------------------------------------------------------------------------
// One scenario's state. The facilitator's side is a session (items, the active
// item, who has joined and who is connected); a participant's side is the view
// they took from the facilitator's snapshot.
// ---------------------------------------------------------------------------

type Data = {
  mode?: 'live' | 'manual'
  sessionName?: string
  unit?: EstimationUnit
  list?: ItemList
  /** participantId → announced name, the facilitator's included. */
  names?: Record<string, string>
  /** participantIds with a live connection right now. */
  connected?: Set<string>
  snapshot?: SessionSnapshot
  /** What the last finalize said. */
  finalized?: ActionResult
  /** The values a Manual-mode finalize was given. */
  manualValues?: [number, number, number]
  /** A participant's view of the round. */
  view?: LiveRound | null
  sessionFields?: { sessionName?: string; unit: EstimationUnit }
  /** An incoming estimate's fate: the round's new estimates, or null if dropped. */
  accepted?: Estimate[] | null
  /** Ids of the participants who have submitted this round. */
  submitted?: Set<string>
  sendFailed?: boolean
  roster?: RosterEntry[]
  /** Whether the round is revealed, for steps without a facilitator item. */
  revealed?: boolean
  resent?: boolean
  labelIds?: string[]
  self?: { id: string; label: string }
  departed?: string
  otherTabConnected?: boolean
  entry?: (ConnectionEntry & { participantId?: string }) | null
  role?: 'facilitator' | 'participant'
  link?: ConnectionStatus
  reachedFacilitator?: boolean
  connection?: { connectionStatus: LiveConnectionStatus; hasEverConnected: boolean }
  peers?: number
  unsaved?: boolean
  leaving?: LeaveConfirmation
  summaryOpened?: boolean
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

/** A participant's id is their name in lower case, so steps can name people. */
const idOf = (name: string) => name.toLowerCase()

/** An item's id is its title, slugged. */
const itemIdOf = (title: string) => title.toLowerCase().replace(/\s+/g, '-')

function list(state: Data): ItemList {
  return (state.list ??= { items: [], activeItemId: null })
}

function names(state: Data): Record<string, string> {
  return (state.names ??= { [FACILITATOR_PARTICIPANT_ID]: 'Facilitator' })
}

function connected(state: Data): Set<string> {
  return (state.connected ??= new Set())
}

function submitted(state: Data): Set<string> {
  return (state.submitted ??= new Set())
}

function itemTitled(state: Data, title: string): Item {
  const item = list(state).items.find((candidate) => candidate.title === title)
  if (!item) throw new Error(`No item "${title}" — an earlier step must add it`)
  return item
}

/** The single item a scenario is about: the active one, else the only one. */
function theItem(state: Data): Item {
  const { items, activeItemId } = list(state)
  const item = items.find((candidate) => candidate.id === activeItemId) ?? items[0]
  if (!item) throw new Error('No item yet — an earlier step must add it')
  return item
}

function patchItem(state: Data, id: string, patch: Partial<Item>) {
  const current = list(state)
  current.items = current.items.map((item) =>
    item.id === id ? { ...item, ...patch } : item,
  )
}

function setItems(state: Data, items: Item[], activeTitle?: string) {
  state.list = {
    items,
    activeItemId:
      activeTitle === undefined
        ? null
        : (items.find((item) => item.title === activeTitle)?.id ?? null),
  }
}

/** Adds the item `title`, or finds it if it is already there, and makes it active. */
function activate(state: Data, title: string, overrides: Partial<Item> = {}): Item {
  const current = list(state)
  let item = current.items.find((candidate) => candidate.title === title)
  if (item) {
    patchItem(state, item.id, overrides)
    item = { ...item, ...overrides }
  } else {
    item = itemOf({ id: itemIdOf(title), title, ...overrides })
    current.items = [...current.items, item]
  }
  current.activeItemId = item.id
  return item
}

function estimatesFrom(table: DataTable): Estimate[] {
  return table
    .hashes()
    .map((row) =>
      estimateOf(
        idOf(row.participant!),
        Number(row.best),
        Number(row.likely),
        Number(row.worst),
      ),
    )
}

function join(state: Data, ...people: string[]) {
  for (const name of people) {
    names(state)[idOf(name)] = name
    connected(state).add(idOf(name))
  }
}

function snapshotOf(state: Data): SessionSnapshot {
  const { items, activeItemId } = list(state)
  return buildSessionSnapshot({
    sessionName: state.sessionName ?? 'Sprint',
    unit: state.unit ?? 'days',
    items,
    activeItemId,
    participantNames: names(state),
    connectedParticipantIds: connected(state),
  })
}

const yesNo = (value: string | undefined) => {
  if (value === 'yes') return true
  if (value === 'no') return false
  throw new Error(`Use yes or no, not "${value}"`)
}

// ---------------------------------------------------------------------------
// item-lifecycle.feature
// ---------------------------------------------------------------------------

Given(
  'the item {string} has the revealed estimates',
  (world: QuickPickleWorld, title: string, table: DataTable) => {
    activate(data(world), title, { submissions: estimatesFrom(table), revealed: true })
  },
)

Given(
  'the item {string} has a revealed round without estimates',
  (world: QuickPickleWorld, title: string) => {
    activate(data(world), title, { revealed: true })
  },
)

Given(
  'the item {string} has the estimates of {word} and {word}, not yet revealed',
  (world: QuickPickleWorld, title: string, first: string, second: string) => {
    activate(data(world), title, {
      submissions: [estimateOf(idOf(first)), estimateOf(idOf(second))],
    })
  },
)

Given(
  'the item {string} in round {int} has the revealed estimates of {word} and {word}',
  (
    world: QuickPickleWorld,
    title: string,
    round: number,
    first: string,
    second: string,
  ) => {
    activate(data(world), title, {
      round,
      revealed: true,
      submissions: [estimateOf(idOf(first), 2, 3, 5), estimateOf(idOf(second), 3, 4, 8)],
    })
  },
)

Given(
  'the item {string} in round {int} is finalized from the revealed estimates of {word} and {word}',
  (
    world: QuickPickleWorld,
    title: string,
    round: number,
    first: string,
    second: string,
  ) => {
    const submissions = [
      estimateOf(idOf(first), 2, 3, 5),
      estimateOf(idOf(second), 3, 4, 8),
    ]
    activate(data(world), title, {
      round,
      revealed: true,
      submissions,
      finalResult: aggregateEstimates(submissions),
    })
  },
)

Given(
  'the item {string} in a Manual-mode session',
  (world: QuickPickleWorld, title: string) => {
    const state = data(world)
    state.mode = 'manual'
    activate(state, title)
  },
)

Given(
  'the item {string} in a Manual-mode session is finalized with the values {int}, {int} and {int}',
  (
    world: QuickPickleWorld,
    title: string,
    best: number,
    likely: number,
    worst: number,
  ) => {
    const state = data(world)
    state.mode = 'manual'
    activate(state, title, {
      finalResult: aggregateEstimates([
        estimateOf(FACILITATOR_PARTICIPANT_ID, best, likely, worst),
      ]),
    })
  },
)

When('the facilitator finalizes it', (world: QuickPickleWorld) => {
  // The live finalize use case: refused until revealed, then the aggregate of
  // the round's estimates.
  const state = data(world)
  const item = theItem(state)
  const allowed = canFinalizeLive(item)
  if (!allowed.ok) {
    state.finalized = allowed
    return
  }
  const result = finalResultFor(item.submissions)
  if (!result.ok) {
    state.finalized = result
    return
  }
  patchItem(state, item.id, { finalResult: result.value })
  state.finalized = { ok: true }
})

When(
  'the facilitator finalizes it with the values {int}, {int} and {int}',
  (world: QuickPickleWorld, best: number, likely: number, worst: number) => {
    // The Manual-mode finalize: the facilitator's own values, no reveal.
    const state = data(world)
    const item = theItem(state)
    state.manualValues = [best, likely, worst]
    const result = finalResultFor([
      estimateOf(FACILITATOR_PARTICIPANT_ID, best, likely, worst),
    ])
    if (!result.ok) {
      state.finalized = result
      return
    }
    patchItem(state, item.id, { finalResult: result.value })
    state.finalized = { ok: true }
  },
)

When('the facilitator retries the round', (world: QuickPickleWorld) => {
  const state = data(world)
  const item = theItem(state)
  patchItem(state, item.id, retryRoundPatch(item))
})

When('the facilitator reopens it', (world: QuickPickleWorld) => {
  const state = data(world)
  const item = theItem(state)
  patchItem(state, item.id, retryRoundPatch(item))
})

Then(
  'its final result is the aggregate of those estimates',
  (world: QuickPickleWorld) => {
    const item = theItem(data(world))
    expect(item.finalResult).toEqual(aggregateEstimates(item.submissions))
  },
)

Then('its final result is the aggregate of those values', (world: QuickPickleWorld) => {
  const state = data(world)
  const [best, likely, worst] = required(state, 'manualValues')
  expect(theItem(state).finalResult).toEqual(
    aggregateEstimates([estimateOf(FACILITATOR_PARTICIPANT_ID, best, likely, worst)]),
  )
})

Then(
  'its final result is the aggregate of the values {int}, {int} and {int}',
  (world: QuickPickleWorld, best: number, likely: number, worst: number) => {
    expect(theItem(data(world)).finalResult).toEqual(
      aggregateEstimates([estimateOf(FACILITATOR_PARTICIPANT_ID, best, likely, worst)]),
    )
  },
)

Then(
  'finalizing is refused because no estimates have been submitted yet',
  (world: QuickPickleWorld) => {
    expect(data(world).finalized).toEqual({
      ok: false,
      error: 'No estimates have been submitted yet.',
    })
  },
)

Then('finalizing is refused until the round is revealed', (world: QuickPickleWorld) => {
  expect(data(world).finalized).toEqual({ ok: false, error: 'Reveal the round first.' })
})

Then('the item is still pending', (world: QuickPickleWorld) => {
  expect(theItem(data(world)).finalResult).toBeNull()
})

Then('the item is pending again', (world: QuickPickleWorld) => {
  expect(theItem(data(world)).finalResult).toBeNull()
})

Then('the item is in round {int}', (world: QuickPickleWorld, round: number) => {
  expect(theItem(data(world)).round).toBe(round)
})

Then('the round is not revealed', (world: QuickPickleWorld) => {
  expect(theItem(data(world)).revealed).toBe(false)
})

Then('the round has no estimates', (world: QuickPickleWorld) => {
  expect(theItem(data(world)).submissions).toEqual([])
})

// ---------------------------------------------------------------------------
// privacy-before-reveal.feature
// ---------------------------------------------------------------------------

Given(
  "{word} and {word} have joined the facilitator's session",
  (world: QuickPickleWorld, first: string, second: string) => {
    join(data(world), first, second)
  },
)

Given(
  "{word} has joined the facilitator's session",
  (world: QuickPickleWorld, name: string) => {
    join(data(world), name)
  },
)

Given('the item {string} is active', (world: QuickPickleWorld, title: string) => {
  activate(data(world), title)
})

Given(
  '{word} has submitted an estimate for it',
  (world: QuickPickleWorld, name: string) => {
    const state = data(world)
    const item = theItem(state)
    patchItem(state, item.id, {
      submissions: [...item.submissions, estimateOf(idOf(name))],
    })
  },
)

Given(
  '{word} and {word} have submitted estimates for it',
  (world: QuickPickleWorld, first: string, second: string) => {
    const state = data(world)
    const item = theItem(state)
    patchItem(state, item.id, {
      submissions: [
        ...item.submissions,
        estimateOf(idOf(first)),
        estimateOf(idOf(second)),
      ],
    })
  },
)

Given(
  "an estimate for it arrives from {word}, who hasn't announced a name yet",
  (world: QuickPickleWorld, name: string) => {
    const state = data(world)
    const item = theItem(state)
    const submissions = acceptRemoteEstimate(
      item,
      item.id,
      estimateOf(idOf(name)),
      item.round,
    )
    if (!submissions) throw new Error('The estimate was dropped')
    patchItem(state, item.id, { submissions })
  },
)

Given("{word}'s connection has dropped", (world: QuickPickleWorld, name: string) => {
  connected(data(world)).delete(idOf(name))
})

Given(
  'the facilitator loaded a session whose item {string} is already finalized',
  (world: QuickPickleWorld, title: string) => {
    const state = data(world)
    list(state).items.push(
      itemOf({ id: itemIdOf(title), title, finalResult: aggregateOf(2, 3, 6) }),
    )
  },
)

When('the facilitator reveals the round', (world: QuickPickleWorld) => {
  const state = data(world)
  patchItem(state, theItem(state).id, { revealed: true })
})

When('the facilitator shares the session snapshot', (world: QuickPickleWorld) => {
  const state = data(world)
  state.snapshot = snapshotOf(state)
})

When('shares the session snapshot', (world: QuickPickleWorld) => {
  const state = data(world)
  state.snapshot = snapshotOf(state)
})

Then('the snapshot holds no estimates', (world: QuickPickleWorld) => {
  expect(required(data(world), 'snapshot').submissions).toEqual([])
})

Then(
  'the snapshot holds the estimates of {word} and {word}',
  (world: QuickPickleWorld, first: string, second: string) => {
    const snapshot = required(data(world), 'snapshot')
    expect(snapshot.submissions.map((estimate) => estimate.participantId)).toEqual([
      idOf(first),
      idOf(second),
    ])
  },
)

Then('its roster reads', (world: QuickPickleWorld, table: DataTable) => {
  const roster = required(data(world), 'snapshot').roster
  const rows = table.hashes()
  expect(roster.map((entry) => entry.participantId)).toEqual(
    rows.map((row) => idOf(row.participant!)),
  )
  rows.forEach((row, index) => {
    const entry = roster[index]!
    if (row.submitted !== undefined) expect(entry.submitted).toBe(yesNo(row.submitted))
    if (row.connected !== undefined) expect(entry.connected).toBe(yesNo(row.connected))
  })
})

Then('its roster lists only {word}', (world: QuickPickleWorld, name: string) => {
  const roster = required(data(world), 'snapshot').roster
  expect(roster.map((entry) => entry.participantId)).toEqual([idOf(name)])
})

Then(
  'the snapshot holds the final result of {string}',
  (world: QuickPickleWorld, title: string) => {
    const state = data(world)
    expect(required(state, 'snapshot').finalResult).toEqual(
      itemTitled(state, title).finalResult,
    )
  },
)

// ---------------------------------------------------------------------------
// late-join-and-reconnect.feature
// ---------------------------------------------------------------------------

Given(
  "the facilitator's active item is {string} in round {int}",
  (world: QuickPickleWorld, title: string, round: number) => {
    activate(data(world), title, { round })
  },
)

Given(
  "the facilitator's active item is {string}, finalized in a loaded session",
  (world: QuickPickleWorld, title: string) => {
    activate(data(world), title, { finalResult: aggregateOf(2, 3, 6) })
  },
)

Given(
  '{word} has seen the round on {string}',
  (world: QuickPickleWorld, _name: string, title: string) => {
    const state = data(world)
    activate(state, title)
    state.view = adoptSnapshot(null, snapshotOf(state))
  },
)

Given('the facilitator has no active item', (world: QuickPickleWorld) => {
  list(data(world)).activeItemId = null
})

Given(
  '{int} of {int} participants has submitted',
  (world: QuickPickleWorld, count: number, of: number) => {
    const state = data(world)
    const people = ['Sam', 'Alex', 'Kim', 'Lee', 'Max'].slice(0, of)
    join(state, ...people)
    const item = theItem(state)
    patchItem(state, item.id, {
      submissions: people.slice(0, count).map((name) => estimateOf(idOf(name))),
    })
  },
)

Given(
  'the round is revealed with the estimates of {word} and {word}',
  (world: QuickPickleWorld, first: string, second: string) => {
    const state = data(world)
    join(state, first, second)
    patchItem(state, theItem(state).id, {
      revealed: true,
      submissions: [estimateOf(idOf(first)), estimateOf(idOf(second))],
    })
  },
)

Given(
  "the facilitator's session is named {string} and estimated in {word}",
  (world: QuickPickleWorld, sessionName: string, unit: string) => {
    const state = data(world)
    state.sessionName = sessionName
    state.unit = unit as EstimationUnit
    activate(state, 'Login')
  },
)

When(
  '{word} takes the snapshot, having seen nothing before',
  (world: QuickPickleWorld, _name: string) => {
    const state = data(world)
    state.view = adoptSnapshot(null, snapshotOf(state))
  },
)

When('{word} takes the snapshot', (world: QuickPickleWorld, _name: string) => {
  const state = data(world)
  const snapshot = snapshotOf(state)
  state.view = adoptSnapshot(state.view ?? null, snapshot)
  state.sessionFields = sessionFieldsFromSnapshot('participant', snapshot)
})

Then(
  '{word} sees the item {string}',
  (world: QuickPickleWorld, _name: string, title: string) => {
    expect(required(data(world), 'view').item.title).toBe(title)
  },
)

Then(
  '{word} sees that {int} of {int} participants has submitted',
  (world: QuickPickleWorld, _name: string, count: number, of: number) => {
    const roster = required(data(world), 'view').roster
    expect(roster.filter((entry) => entry.submitted)).toHaveLength(count)
    expect(roster).toHaveLength(of)
  },
)

Then("the round is open for {word}'s estimate", (world: QuickPickleWorld) => {
  expect(livePhaseOf(required(data(world), 'view')).phase).toBe('open')
})

Then("the round is not open for {word}'s estimate", (world: QuickPickleWorld) => {
  expect(livePhaseOf(required(data(world), 'view')).phase).not.toBe('open')
})

Then(
  '{word} sees the revealed estimates of {word} and {word}',
  (world: QuickPickleWorld, _name: string, first: string, second: string) => {
    const view = required(data(world), 'view')
    expect(livePhaseOf(view).phase).toBe('revealed')
    expect(view.submissions.map((estimate) => estimate.participantId)).toEqual([
      idOf(first),
      idOf(second),
    ])
  },
)

Then(
  '{word} sees the final result of {string}',
  (world: QuickPickleWorld, _name: string, title: string) => {
    const state = data(world)
    expect(required(state, 'view').finalResult).toEqual(
      itemTitled(state, title).finalResult,
    )
  },
)

Then('{word} has no round to estimate', (world: QuickPickleWorld) => {
  expect(data(world).view).toBeNull()
})

Then(
  '{word} sees the session name {string}',
  (world: QuickPickleWorld, _name: string, sessionName: string) => {
    expect(required(data(world), 'sessionFields').sessionName).toBe(sessionName)
  },
)

Then(
  '{word} estimates in {word}',
  (world: QuickPickleWorld, _name: string, unit: string) => {
    expect(required(data(world), 'sessionFields').unit).toBe(unit)
  },
)

Given(
  '{word} has submitted an estimate for {string} in round {int}',
  (world: QuickPickleWorld, name: string, title: string, round: number) => {
    const state = data(world)
    join(state, name)
    activate(state, title, { round })
    const seen = adoptSnapshot(null, snapshotOf(state))
    state.view = recordOwnSubmission(seen, estimateOf(idOf(name)))
  },
)

Given("{word}'s connection drops", () => {
  // Nothing to do: a participant's view outlives the drop, and the reconnect
  // below brings the facilitator's latest snapshot.
})

When(
  "{word} reconnects and the facilitator's active item is {string} in round {int}",
  (world: QuickPickleWorld, _name: string, title: string, round: number) => {
    const state = data(world)
    activate(state, title, { round })
    state.view = adoptSnapshot(state.view ?? null, snapshotOf(state))
  },
)

Then(
  "{word}'s own estimate is {word}",
  (world: QuickPickleWorld, name: string, fate: string) => {
    const mine = required(data(world), 'view').mySubmission
    if (fate === 'kept') expect(mine?.participantId).toBe(idOf(name))
    else if (fate === 'dropped') expect(mine).toBeNull()
    else throw new Error(`Use kept or dropped, not "${fate}"`)
  },
)

Given(
  'the round on {string} has the estimates',
  (world: QuickPickleWorld, title: string, table: DataTable) => {
    activate(data(world), title, { submissions: estimatesFrom(table) })
  },
)

When(
  'an estimate of {int}, {int} and {int} arrives from {word} again',
  (
    world: QuickPickleWorld,
    best: number,
    likely: number,
    worst: number,
    name: string,
  ) => {
    const state = data(world)
    const item = theItem(state)
    const estimate = estimateOf(idOf(name), best, likely, worst)
    const submissions = acceptRemoteEstimate(item, item.id, estimate, item.round)
    if (!submissions) throw new Error('The estimate was dropped')
    patchItem(state, item.id, { submissions })
  },
)

Then('the round has the estimates', (world: QuickPickleWorld, table: DataTable) => {
  expect(theItem(data(world)).submissions).toEqual(estimatesFrom(table))
})

Given('the round is open', (world: QuickPickleWorld) => {
  data(world).revealed = false
})

Given('the round is revealed', (world: QuickPickleWorld) => {
  const state = data(world)
  state.revealed = true
  if (state.list?.activeItemId)
    patchItem(state, state.list.activeItemId, { revealed: true })
})

Given('the item is finalized', (world: QuickPickleWorld) => {
  const state = data(world)
  // Finalized without a reveal in this session, as a loaded item is: a live
  // finalize always follows a reveal, which the revealed example covers.
  patchItem(state, theItem(state).id, { finalResult: aggregateOf(2, 3, 6) })
})

When(
  'an estimate from {word} arrives for {string} in round {int}',
  (world: QuickPickleWorld, name: string, title: string, round: number) => {
    const state = data(world)
    const item = theItem(state)
    state.accepted = acceptRemoteEstimate(
      item,
      itemIdOf(title),
      estimateOf(idOf(name)),
      round,
    )
  },
)

Then("the round has {word}'s estimate", (world: QuickPickleWorld, name: string) => {
  const accepted = required(data(world), 'accepted')
  expect(accepted.map((estimate) => estimate.participantId)).toEqual([idOf(name)])
})

Then('the estimate is dropped', (world: QuickPickleWorld) => {
  expect(data(world).accepted).toBeNull()
})

// ---------------------------------------------------------------------------
// submission-delivery.feature
// ---------------------------------------------------------------------------

function rosterShowing(state: Data, name: string, isSubmitted: boolean) {
  state.roster = [{ participantId: idOf(name), submitted: isSubmitted, connected: true }]
}

Given('{word} has sent an estimate', (world: QuickPickleWorld, name: string) => {
  submitted(data(world)).add(idOf(name))
})

Given("the send hasn't failed", (world: QuickPickleWorld) => {
  data(world).sendFailed = false
})

Given('the send failed', (world: QuickPickleWorld) => {
  data(world).sendFailed = true
})

function onlySender(state: Data): string {
  const [id] = [...submitted(state)]
  if (!id) throw new Error('Nobody has sent or submitted an estimate yet')
  return id
}

Given("the facilitator's roster doesn't show it yet", (world: QuickPickleWorld) => {
  const state = data(world)
  rosterShowing(state, onlySender(state), false)
})

Given("the facilitator's roster doesn't show it", (world: QuickPickleWorld) => {
  const state = data(world)
  state.roster = [...submitted(state)].map((participantId) => ({
    participantId,
    submitted: false,
    connected: true,
  }))
})

Given("the facilitator's roster shows it as submitted", (world: QuickPickleWorld) => {
  const state = data(world)
  rosterShowing(state, onlySender(state), true)
})

Then(
  "{word}'s estimate is shown as {string}",
  (world: QuickPickleWorld, name: string, shown: string) => {
    const state = data(world)
    const delivery = deliveryStateFor(
      required(state, 'roster'),
      idOf(name),
      state.sendFailed ?? false,
    )
    expect(delivery).toBe(shown === 'not delivered' ? 'not-delivered' : shown)
  },
)

Given('{word} has submitted an estimate', (world: QuickPickleWorld, name: string) => {
  submitted(data(world)).add(idOf(name))
})

Given("{word} hasn't submitted", (world: QuickPickleWorld, name: string) => {
  submitted(data(world)).delete(idOf(name))
})

When(
  "{word} takes the facilitator's snapshot after reconnecting",
  (world: QuickPickleWorld, name: string) => {
    const state = data(world)
    const id = idOf(name)
    const roster = state.roster ?? [
      { participantId: id, submitted: false, connected: true },
    ]
    const before: LiveRound = {
      item: { id: 'login', title: 'Login', description: '' },
      submissions: [],
      revealed: false,
      round: 0,
      roster: [],
      mySubmission: null,
      finalResult: null,
    }
    const seen = submitted(state).has(id)
      ? recordOwnSubmission(before, estimateOf(id))
      : before
    const snapshot: SessionSnapshot = {
      currentItem: before.item,
      sessionName: 'Sprint',
      unit: 'days',
      revealed: state.revealed ?? false,
      round: 0,
      roster,
      submissions: [],
      finalizedItemIds: [],
      finalResult: null,
    }
    state.resent = needsResend(adoptSnapshot(seen, snapshot), id)
  },
)

Then("{word}'s estimate is sent again", (world: QuickPickleWorld) => {
  expect(data(world).resent).toBe(true)
})

Then("{word}'s estimate is not sent again", (world: QuickPickleWorld) => {
  expect(data(world).resent).toBe(false)
})

// ---------------------------------------------------------------------------
// participant-names.feature
// ---------------------------------------------------------------------------

function labels(state: Data): string[] {
  return participantLabels(required(state, 'labelIds'), names(state), state.self)
}

Given('the round has the participants', (world: QuickPickleWorld, table: DataTable) => {
  const state = data(world)
  state.labelIds = table.hashes().map((row) => {
    const name = row['announced name']
    if (name) names(state)[row.participant!] = name
    return row.participant!
  })
})

Given(
  'the round has the unnamed participants {word}, {word} and {word}',
  (world: QuickPickleWorld, first: string, second: string, third: string) => {
    data(world).labelIds = [first, second, third]
  },
)

When(
  '{word} announces the name {string}',
  (world: QuickPickleWorld, id: string, name: string) => {
    names(data(world))[id] = name
  },
)

When(
  '{word} looks at the revealed round, with their own row labelled {string}',
  (world: QuickPickleWorld, id: string, label: string) => {
    data(world).self = { id, label }
  },
)

for (const text of [
  'they are labelled {string}, {string} and {string}',
  'the participants are labelled {string}, {string} and {string}',
]) {
  Then(text, (world: QuickPickleWorld, first: string, second: string, third: string) => {
    expect(labels(data(world))).toEqual([first, second, third])
  })
}

Given('{word} has left the session', (world: QuickPickleWorld, name: string) => {
  data(world).departed = idOf(name)
})

Given("no other tab of {word}'s is connected", (world: QuickPickleWorld) => {
  data(world).otherTabConnected = false
})

Given("another tab of {word}'s is connected", (world: QuickPickleWorld) => {
  data(world).otherTabConnected = true
})

Then("{word}'s name is {word}", (world: QuickPickleWorld, name: string, fate: string) => {
  const state = data(world)
  const id = idOf(name)
  // Other participants stay connected either way.
  const stillConnected = state.otherTabConnected ? ['alex', id] : ['alex']
  const pruned = shouldPruneDeparted(id, stillConnected, [...submitted(state)])
  if (fate === 'kept') expect(pruned).toBe(false)
  else if (fate === 'forgotten') expect(pruned).toBe(true)
  else throw new Error(`Use kept or forgotten, not "${fate}"`)
})

// ---------------------------------------------------------------------------
// joining.feature
// ---------------------------------------------------------------------------

When(
  'the facilitator starts a live session with the code {string}',
  (world: QuickPickleWorld, code: string) => {
    data(world).entry = facilitatorStart(code)
  },
)

Then("the session's code is {string}", (world: QuickPickleWorld, code: string) => {
  expect(required(data(world), 'entry').sessionId).toBe(code)
})

Then('the facilitator is named {string}', (world: QuickPickleWorld, name: string) => {
  expect(required(data(world), 'entry').myName).toBe(name)
})

Then('the facilitator is connecting', (world: QuickPickleWorld) => {
  expect(required(data(world), 'entry').connectionStatus).toBe('connecting')
})

When(
  'a participant joins with the code {string} and the name {string}',
  (world: QuickPickleWorld, code: string, name: string) => {
    data(world).entry = participantJoin(code, name, 'participant-id')
  },
)

Then(
  'they join the session {string} as {string}',
  (world: QuickPickleWorld, code: string, name: string) => {
    const entry = required(data(world), 'entry')
    expect(entry.sessionId).toBe(code)
    expect(entry.myName).toBe(name)
  },
)

Then("the join doesn't go ahead", (world: QuickPickleWorld) => {
  expect(data(world).entry).toBeNull()
})

Given(
  'a {word} whose link reports {string}',
  (world: QuickPickleWorld, role: string, link: string) => {
    const state = data(world)
    state.role = role as 'facilitator' | 'participant'
    state.link = link as ConnectionStatus
  },
)

Given('the participant has reached the facilitator', (world: QuickPickleWorld) => {
  data(world).reachedFacilitator = true
})

Given("the participant hasn't reached the facilitator", (world: QuickPickleWorld) => {
  data(world).reachedFacilitator = false
})

Then(
  'the {word} is {string}',
  (world: QuickPickleWorld, role: string, status: string) => {
    const state = data(world)
    expect(role).toBe(required(state, 'role'))
    expect(
      deriveConnectionStatus(
        required(state, 'role'),
        required(state, 'link'),
        state.reachedFacilitator ?? false,
      ),
    ).toBe(status)
  },
)

Given('a participant who is connecting', (world: QuickPickleWorld) => {
  data(world).connection = { connectionStatus: 'connecting', hasEverConnected: false }
})

for (const text of ['the link reports {string}', 'then the link reports {string}']) {
  When(text, (world: QuickPickleWorld, status: string) => {
    const state = data(world)
    state.connection = withConnectionStatus(
      required(state, 'connection'),
      status as LiveConnectionStatus,
    )
  })
}

Then('the participant has never been in the session', (world: QuickPickleWorld) => {
  expect(required(data(world), 'connection').hasEverConnected).toBe(false)
})

Then('the participant has been in the session before', (world: QuickPickleWorld) => {
  expect(required(data(world), 'connection').hasEverConnected).toBe(true)
})

// ---------------------------------------------------------------------------
// leaving.feature
// ---------------------------------------------------------------------------

const modeOf = (mode: string): 'live' | 'manual' => {
  if (mode === 'Live') return 'live'
  if (mode === 'Manual') return 'manual'
  throw new Error(`Use Live or Manual, not "${mode}"`)
}

Given(
  'a {word} session with {int} teammates still connected',
  (world: QuickPickleWorld, mode: string, peers: number) => {
    const state = data(world)
    state.mode = modeOf(mode)
    state.peers = peers
  },
)

Given('the session has no unsaved changes', (world: QuickPickleWorld) => {
  data(world).unsaved = false
})

Given('the session has unsaved changes', (world: QuickPickleWorld) => {
  data(world).unsaved = true
})

When('the facilitator leaves the Workspace', (world: QuickPickleWorld) => {
  const state = data(world)
  state.leaving = leaveConfirmation(
    required(state, 'mode'),
    required(state, 'peers'),
    state.unsaved ?? false,
  )
})

const LEAVING: Record<string, LeaveConfirmation> = {
  'goes ahead without asking': 'none',
  'asks first, naming the unsaved changes': 'unsaved',
  'asks first, naming the live teammates': 'live-peers',
  'asks first, naming the unsaved changes and the teammates': 'unsaved-and-live-peers',
}

Then('leaving {}', (world: QuickPickleWorld, outcome: string) => {
  const expected = LEAVING[outcome]
  if (!expected) throw new Error(`Unknown leaving outcome "${outcome}"`)
  expect(data(world).leaving).toBe(expected)
})

Given(
  'a {word} in a {word} session',
  (world: QuickPickleWorld, role: string, mode: string) => {
    const state = data(world)
    state.role = role as 'facilitator' | 'participant'
    state.mode = modeOf(mode)
  },
)

Then('they hold a session that can be saved', (world: QuickPickleWorld) => {
  expect(holdsItemList(required(data(world), 'role'))).toBe(true)
})

Then("they don't hold a session that can be saved", (world: QuickPickleWorld) => {
  expect(holdsItemList(required(data(world), 'role'))).toBe(false)
})

// ---------------------------------------------------------------------------
// item-list.feature and navigation.feature
// ---------------------------------------------------------------------------

const pendingItem = (title: string) => itemOf({ id: itemIdOf(title), title })

Given('no items', (world: QuickPickleWorld) => {
  setItems(data(world), [])
})

Given(
  'the items {string} and {string}',
  (world: QuickPickleWorld, a: string, b: string) => {
    setItems(data(world), [pendingItem(a), pendingItem(b)])
  },
)

Given(
  'the items {string}, {string} and {string}',
  (world: QuickPickleWorld, a: string, b: string, c: string) => {
    setItems(data(world), [pendingItem(a), pendingItem(b), pendingItem(c)])
  },
)

Given(
  'the items {string} and {string} with {string} active',
  (world: QuickPickleWorld, a: string, b: string, active: string) => {
    setItems(data(world), [pendingItem(a), pendingItem(b)], active)
  },
)

Given('the items', (world: QuickPickleWorld, table: DataTable) => {
  const items = table.hashes().map((row) => {
    if (row.state === 'pending') return pendingItem(row.item!)
    if (row.state === 'finalized') {
      return itemOf({
        id: itemIdOf(row.item!),
        title: row.item!,
        finalResult: aggregateOf(2, 3, 6),
      })
    }
    throw new Error(`Use pending or finalized, not "${row.state}"`)
  })
  setItems(data(world), items)
})

Given('{string} is active', (world: QuickPickleWorld, title: string) => {
  const state = data(world)
  list(state).activeItemId = itemTitled(state, title).id
})

When(
  'the facilitator adds the item {string}',
  (world: QuickPickleWorld, title: string) => {
    const state = data(world)
    const next = appendItem(list(state), {
      id: `added-${title.trim()}`,
      title,
      description: '',
    })
    if (next) state.list = next
  },
)

When(
  'the facilitator renames {string} to {string}',
  (world: QuickPickleWorld, title: string, renamed: string) => {
    const state = data(world)
    const items = renameItem(list(state).items, itemTitled(state, title).id, renamed)
    if (items) list(state).items = items
  },
)

When('the facilitator removes {string}', (world: QuickPickleWorld, title: string) => {
  const state = data(world)
  state.list = removeItemFrom(list(state), itemTitled(state, title).id)
})

When(
  'the facilitator moves {string} to position {int}',
  (world: QuickPickleWorld, title: string, position: number) => {
    const state = data(world)
    const items = list(state).items
    const moved = moveItem(items, items.indexOf(itemTitled(state, title)), position - 1)
    if (moved) list(state).items = moved
  },
)

function activeIndex(state: Data): number {
  const { items, activeItemId } = list(state)
  return items.findIndex((item) => item.id === activeItemId)
}

When('the facilitator presses Next', (world: QuickPickleWorld) => {
  const state = data(world)
  const move = advanceFrom(list(state).items, activeIndex(state))
  if (move.kind === 'select') list(state).activeItemId = move.itemId
  if (move.kind === 'summary') {
    state.summaryOpened = true
    if (move.clearSelection) list(state).activeItemId = null
  }
})

When('the facilitator presses Previous', (world: QuickPickleWorld) => {
  const state = data(world)
  const previous = previousItemId(list(state).items, activeIndex(state))
  if (previous !== null) list(state).activeItemId = previous
})

function titles(state: Data): string[] {
  return list(state).items.map((item) => item.title)
}

Then(
  'the items are {string} and {string}',
  (world: QuickPickleWorld, a: string, b: string) => {
    expect(titles(data(world))).toEqual([a, b])
  },
)

Then(
  'the items are {string}, {string} and {string}',
  (world: QuickPickleWorld, a: string, b: string, c: string) => {
    expect(titles(data(world))).toEqual([a, b, c])
  },
)

function activeTitle(state: Data): string | null {
  const { items, activeItemId } = list(state)
  return items.find((item) => item.id === activeItemId)?.title ?? null
}

for (const text of ['the active item is {string}', 'the active item is still {string}']) {
  Then(text, (world: QuickPickleWorld, title: string) => {
    expect(activeTitle(data(world))).toBe(title)
  })
}

for (const text of ['no item is active', 'no item is active anymore']) {
  Then(text, (world: QuickPickleWorld) => {
    expect(list(data(world)).activeItemId).toBeNull()
  })
}

Then('the Session Summary opens', (world: QuickPickleWorld) => {
  expect(data(world).summaryOpened).toBe(true)
})
