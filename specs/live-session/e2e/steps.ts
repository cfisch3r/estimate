import {
  createCollaborativeSession,
  joinSessionAsParticipant,
  addItem,
  submitEstimate,
  expectItemVisible,
  expectSubmittedCount,
} from '../../../e2e/helpers'
import { Given, When, Then, requireSessionCode } from './world'
import type { Actor, ScenarioState } from './world'

/** Shared by the "has joined the session" (Given) and "joins the session"
 *  (When) step texts — same action, phrased differently for a late joiner
 *  vs. an already-present participant. */
async function joinSession(actor: Actor, state: ScenarioState, name: string) {
  const page = await actor(name)
  await joinSessionAsParticipant(page, requireSessionCode(state), name)
}

Given('a facilitator has started a collaborative session', async ({ actor, state }) => {
  const page = await actor('Facilitator')
  state.sessionCode = await createCollaborativeSession(page)
})

Given('the item {string} is active', async ({ actor }, title: string) => {
  const page = await actor('Facilitator')
  await addItem(page, title)
})

Given('{word} has joined the session', async ({ actor, state }, name: string) => {
  await joinSession(actor, state, name)
})

Given('{word} has submitted an estimate', async ({ actor }, name: string) => {
  const page = await actor(name)
  await submitEstimate(page, { best: 2, likely: 3, worst: 5 })
})

When('{word} joins the session', async ({ actor, state }, name: string) => {
  await joinSession(actor, state, name)
})

Then('{word} sees the item {string}', async ({ actor }, name: string, title: string) => {
  const page = await actor(name)
  await expectItemVisible(page, title)
})

Then(
  '{word} sees that {int} of {int} teammates has submitted',
  async ({ actor }, name: string, submitted: number, total: number) => {
    const page = await actor(name)
    await expectSubmittedCount(page, submitted, total)
  },
)
