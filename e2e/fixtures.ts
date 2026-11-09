import { test as base } from '@playwright/test'
import type { Browser, Page } from '@playwright/test'
import { newIsolatedPage } from './helpers'

interface Roles {
  /** Creates the collaborative session and holds the workspace/reveal view. */
  facilitator: Page
  /** Joins via session code and submits estimates. */
  participant: Page
  /** Joins after the facilitator/participant, mid-round, to exercise the
   *  requestSnapshot pull-on-arrival path (ADR-003). */
  lateJoiner: Page
}

const roleFixture = async (
  { browser }: { browser: Browser },
  use: (page: Page) => Promise<void>,
) => {
  const { page, context } = await newIsolatedPage(browser)
  await use(page)
  await context.close()
}

export const test = base.extend<Roles>({
  facilitator: roleFixture,
  participant: roleFixture,
  lateJoiner: roleFixture,
})

export { expect } from '@playwright/test'
