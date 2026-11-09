import type { BrowserContext, Page } from '@playwright/test'
import { test as base, createBdd } from 'playwright-bdd'
import { newIsolatedPage } from '../../../e2e/helpers'

/** Named actors on demand: each distinct name gets its own browser context
 *  (isolated storage), created the first time that name is used. Separate
 *  contexts are required because same-context pages collide on
 *  `participantId` (see `e2e/fixtures.ts`). */
export type Actor = (name: string) => Promise<Page>

/** Mutable state for one scenario, scoped per test so scenarios never share
 *  state across parallel runs. `sessionCode` is set by the "has started a
 *  collaborative session" step before any step that reads it can run — every
 *  scenario's Given sequence establishes the session before participants join. */
export type ScenarioState = { sessionCode?: string }

/** Reads `sessionCode`, failing with a clear message (rather than a bare
 *  non-null assertion) if a step reads it before the session-creation step
 *  has run. */
export function requireSessionCode(state: ScenarioState): string {
  if (!state.sessionCode) {
    throw new Error(
      'state.sessionCode is unset — this step ran before "a facilitator has started a collaborative session"',
    )
  }
  return state.sessionCode
}

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
      const { page, context } = await newIsolatedPage(browser)
      contexts.push(context)
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
