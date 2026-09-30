import { test as base } from '@playwright/test'
import type { Page } from '@playwright/test'

interface Roles {
  /** Creates the collaborative session and holds the workspace/reveal view. */
  facilitator: Page
  /** Joins via session code and submits estimates. */
  participant: Page
  /** Joins after the facilitator/participant, mid-round, to exercise the
   *  requestSnapshot pull-on-arrival path (ADR-003). */
  lateJoiner: Page
}

/** Each role gets its own browser context (isolated storage), not just a new
 *  tab/page — JoinSession's identity warning ("joining from another tab in
 *  this browser will be treated as the same person") means same-context
 *  pages would collide on participantId; separate contexts don't. */
export const test = base.extend<Roles>({
  facilitator: async ({ browser }, use) => {
    const context = await browser.newContext()
    await use(await context.newPage())
    await context.close()
  },
  participant: async ({ browser }, use) => {
    const context = await browser.newContext()
    await use(await context.newPage())
    await context.close()
  },
  lateJoiner: async ({ browser }, use) => {
    const context = await browser.newContext()
    await use(await context.newPage())
    await context.close()
  },
})

export { expect } from '@playwright/test'
