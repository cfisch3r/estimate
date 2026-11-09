import {
  createCollaborativeSession,
  joinSessionAsParticipant,
  addItem,
  submitEstimate,
  expectItemVisible,
  expectSubmittedCount,
} from '../../../e2e/helpers'
import { Given, When, Then } from './world'

Given('a facilitator has started a collaborative session', async ({ actor, state }) => {
  const page = await actor('Facilitator')
  state.sessionCode = await createCollaborativeSession(page)
})

Given('the item {string} is active', async ({ actor }, title: string) => {
  const page = await actor('Facilitator')
  await addItem(page, title)
})

Given('{word} has joined the session', async ({ actor, state }, name: string) => {
  const page = await actor(name)
  await joinSessionAsParticipant(page, state.sessionCode!, name)
})

Given('{word} has submitted an estimate', async ({ actor }, name: string) => {
  const page = await actor(name)
  await submitEstimate(page, { best: 2, likely: 3, worst: 5 })
})

When('{word} joins the session', async ({ actor, state }, name: string) => {
  const page = await actor(name)
  await joinSessionAsParticipant(page, state.sessionCode!, name)
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
