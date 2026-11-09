import type { BrowserContext, Page } from '@playwright/test'
import { test as base, createBdd } from 'playwright-bdd'

/** Named actors on demand: each distinct name gets its own browser context
 *  (isolated storage), created the first time that name is used. Separate
 *  contexts are required because same-context pages collide on
 *  `participantId` (see `e2e/fixtures.ts`). */
type Actor = (name: string) => Promise<Page>

/** Mutable state for one scenario (e.g. the session code), scoped per test
 *  so scenarios never share state across parallel runs. */
type ScenarioState = { sessionCode?: string }

type Fixtures = {
  actor: Actor
  state: ScenarioState
}

export const test = base.extend<Fixtures>({
  actor: async ({ browser }, use) => {
    const pages = new Map<string, Page>()
    const contexts: BrowserContext[] = []
    const actor: Actor = async (name) => {
      const existing = pages.get(name)
      if (existing) return existing
      const context = await browser.newContext()
      contexts.push(context)
      const page = await context.newPage()
      pages.set(name, page)
      return page
    }
    await use(actor)
    await Promise.all(contexts.map((context) => context.close()))
  },
  state: async ({}, use) => {
    await use({})
  },
})

export const { Given, When, Then } = createBdd(test)
