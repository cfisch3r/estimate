import {
  createCollaborativeSession,
  addItem,
  submitEstimate,
  expectItemVisible,
  expectSubmittedCount,
  followLinkToNewTab,
  openDiagnosis,
  readDiagnosisReport,
  tryJoinUnreachableSession,
} from '../../../e2e/helpers'
import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { Given, When, Then, requireState } from '../../shared/e2e/world'
import type { ScenarioState } from '../../shared/e2e/world'

Given('a facilitator has started a collaborative session', async ({ actor, state }) => {
  const page = await actor('Facilitator')
  state.sessionCode = await createCollaborativeSession(page)
})

Given('the item {string} is active', async ({ actor }, title: string) => {
  const page = await actor('Facilitator')
  await addItem(page, title)
})

Given('{word} has submitted an estimate', async ({ actor }, name: string) => {
  const page = await actor(name)
  await submitEstimate(page, { best: 2, likely: 3, worst: 5 })
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

/** The page on which `name` opened the connection diagnosis. */
function diagnosisPageOf(state: ScenarioState, name: string): Page {
  const page = requireState(state, 'diagnosisPages')[name]
  if (!page) throw new Error(`${name} has not opened the connection diagnosis`)
  return page
}

When('{word} opens the connection diagnosis', async ({ actor, state }, name: string) => {
  const page = await actor(name)
  await openDiagnosis(page)
  state.diagnosisPages = { ...state.diagnosisPages, [name]: page }
})

/** A random code, so no other scenario's session can answer it. */
const unusedSessionCode = () =>
  Array.from(
    { length: 6 },
    () => 'ABCDEFGHJKMNPQRSTUVWXYZ'[Math.floor(Math.random() * 23)],
  ).join('')

Given(
  '{word} has tried to join a session nobody is running',
  async ({ actor }, name: string) => {
    await tryJoinUnreachableSession(await actor(name), unusedSessionCode(), name)
  },
)

When(
  '{word} follows {string} on the problem notice',
  async ({ actor, state }, name: string, link: string) => {
    const from = await actor(name)
    const fromUrl = from.url()
    const opened = await followLinkToNewTab(from, link)
    state.followedLink = { from, fromUrl, opened }
    state.diagnosisPages = { ...state.diagnosisPages, [name]: opened }
  },
)

Then('the connection diagnosis opens in a new tab', async ({ state }) => {
  const { from, fromUrl, opened } = requireState(state, 'followedLink')
  expect(new URL(opened.url()).pathname).toBe('/diagnosis')
  // The page the link was followed from stays where it was.
  expect(from.url()).toBe(fromUrl)
})

Then(
  "{word}'s diagnosis report shows the session as {string}",
  async ({ state }, name: string, status: string) => {
    const report = await readDiagnosisReport(diagnosisPageOf(state, name))
    expect(report).toMatch(new RegExp(`status\\s+${status}\\b`))
  },
)

Then(
  "{word}'s diagnosis report lists a {string} candidate",
  async ({ state }, name: string, type: string) => {
    const report = await readDiagnosisReport(diagnosisPageOf(state, name))
    expect(report).toMatch(new RegExp(`\\b${type}/(udp|tcp)\\b`))
  },
)

Then(
  "{word}'s diagnosis report does not mention {string} or {string}",
  async ({ state }, name: string, first: string, second: string) => {
    const report = await readDiagnosisReport(diagnosisPageOf(state, name))
    expect(report).not.toContain(first)
    expect(report).not.toContain(second)
  },
)
