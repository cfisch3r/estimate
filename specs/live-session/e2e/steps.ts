import {
  createCollaborativeSession,
  addItem,
  submitEstimate,
  expectItemVisible,
  expectSubmittedCount,
} from '../../../e2e/helpers'
import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
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

/** The report text on the diagnosis page (`/diagnosis`), read from the
 *  read-only block the page labels "Diagnosis report". */
async function diagnosisReport(page: Page): Promise<string> {
  const report = page.getByLabel('Diagnosis report')
  await expect(report).toBeVisible()
  return report.innerText()
}

When('{word} opens the connection diagnosis', async ({ actor }, name: string) => {
  const page = await actor(name)
  await page.goto('/diagnosis')
})

Then(
  "{word}'s diagnosis report shows the session as connected",
  async ({ actor }, name: string) => {
    const report = await diagnosisReport(await actor(name))
    expect(report).toMatch(/status\s+connected\b/)
  },
)

Then(
  "{word}'s diagnosis report lists the candidate types of a WebRTC connection",
  async ({ actor }, name: string) => {
    const report = await diagnosisReport(await actor(name))
    expect(report).toMatch(/\b(host|srflx|prflx|relay)\/(udp|tcp)\b/)
  },
)

Then(
  "{word}'s diagnosis report does not mention {string} or {string}",
  async ({ actor }, name: string, first: string, second: string) => {
    const report = await diagnosisReport(await actor(name))
    expect(report).not.toContain(first)
    expect(report).not.toContain(second)
  },
)
