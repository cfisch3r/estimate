import type { BrowserContext, Page } from '@playwright/test'
import { test as base, createBdd } from 'playwright-bdd'
import { newIsolatedPage } from '../../../e2e/helpers'

/** Named actors on demand: each distinct name gets its own browser context
 *  (isolated storage), created the first time that name is used. Separate
 *  contexts are required because same-context pages collide on
 *  `participantId` (see `e2e/fixtures.ts`). */
export type Actor = (name: string) => Promise<Page>

/** Mutable state for one scenario, scoped per test so scenarios never share
 *  state across parallel runs. One type for every concept, because the
 *  shared steps in this folder read it too. */
export type ScenarioState = {
  /** Set when an actor starts a collaborative session. */
  sessionCode?: string
  /** Local path of the session file the next load step picks: either the
   *  file a save step downloaded, or one a Given step wrote as test data. */
  sessionFile?: string
  /** Whether the browser raised its leave-page warning when the tab closed. */
  leavePageWarning?: boolean
}

/** Reads a required state field, failing with a clear message (rather than a
 *  bare non-null assertion) if a step reads it before the step that sets it. */
export function requireState<K extends keyof ScenarioState>(
  state: ScenarioState,
  key: K,
): NonNullable<ScenarioState[K]> {
  const value = state[key]
  if (value === undefined) {
    throw new Error(
      `state.${key} is unset — a step read it before the step that sets it ran`,
    )
  }
  return value as NonNullable<ScenarioState[K]>
}

type Fixtures = {
  actor: Actor
  state: ScenarioState
  /** Builds a path inside this test's own output folder, for downloaded and
   *  hand-written files. */
  filePath: (name: string) => string
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
  filePath: async ({}, use, testInfo) => {
    await use((name) => testInfo.outputPath(name))
  },
})

export const { Given, When, Then } = createBdd(test)
