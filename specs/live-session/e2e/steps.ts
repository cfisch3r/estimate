import {
  createCollaborativeSession,
  addItem,
  submitEstimate,
  expectItemVisible,
  expectSubmittedCount,
  openDiagnosis,
  readDiagnosisReport,
} from '../../../e2e/helpers'
import { expect } from '@playwright/test'
import { Given, When, Then } from '../../shared/e2e/world'

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

When('{word} opens the connection diagnosis', async ({ actor }, name: string) => {
  const page = await actor(name)
  await openDiagnosis(page)
})

Then(
  "{word}'s diagnosis report shows the session as {string}",
  async ({ actor }, name: string, status: string) => {
    const report = await readDiagnosisReport(await actor(name))
    expect(report).toMatch(new RegExp(`status\\s+${status}\\b`))
  },
)

Then(
  "{word}'s diagnosis report lists a {string} candidate",
  async ({ actor }, name: string, type: string) => {
    const report = await readDiagnosisReport(await actor(name))
    expect(report).toMatch(new RegExp(`\\b${type}/(udp|tcp)\\b`))
  },
)

Then(
  "{word}'s diagnosis report does not mention {string} or {string}",
  async ({ actor }, name: string, first: string, second: string) => {
    const report = await readDiagnosisReport(await actor(name))
    expect(report).not.toContain(first)
    expect(report).not.toContain(second)
  },
)
