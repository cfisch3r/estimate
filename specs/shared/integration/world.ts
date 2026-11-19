import { readFile } from 'node:fs/promises'
import type { BrowserContext, Page } from '@playwright/test'
import { test as base, createBdd } from 'playwright-bdd'
import type { FileDownloadApi } from '../../../src/application/ports/outbound/fileDownload'
import { remote } from './remote'
import type { Remote } from './remote'

/** A file the browser actually saved, as Playwright's `download` event saw it. */
export type SavedFile = { suggestedName: string; bytes: Buffer }

/** The file adapter, driven through its port. Its parameters come from the
 *  port; only the result is hand-written, because besides calling the port it
 *  waits for the browser's real `download` event. */
export type FileDriver = {
  download(...args: Parameters<Remote<FileDownloadApi>['download']>): Promise<SavedFile>
}

/** One tab of one browser: tabs of the same browser share a context (and so
 *  share storage), different browsers never do. */
export type Tab = { page: Page; files: FileDriver }

/** Mutable state for one scenario, scoped per test. */
export type ScenarioState = {
  /** The file the last download step saved. */
  savedFile?: SavedFile
}

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

function fileDriver(page: Page): FileDriver {
  const port = remote(page, 'file')
  return {
    async download(...args) {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        port.download(...args),
      ])
      const path = await download.path()
      return {
        suggestedName: download.suggestedFilename(),
        bytes: await readFile(path),
      }
    },
  }
}

type Fixtures = {
  tab: (browser: string, tab: string) => Promise<Tab>
  state: ScenarioState
}

export const test = base.extend<Fixtures>({
  tab: async ({ browser }, use) => {
    const contexts = new Map<string, BrowserContext>()
    const tabs = new Map<string, Tab>()
    await use(async (browserName, tabName) => {
      const key = `${browserName}/${tabName}`
      const existing = tabs.get(key)
      if (existing) return existing
      let context = contexts.get(browserName)
      if (!context) {
        context = await browser.newContext({ acceptDownloads: true })
        contexts.set(browserName, context)
      }
      const page = await context.newPage()
      // The project's `baseURL` is the harness page (playwright.config.ts).
      await page.goto('/')
      const created = { page, files: fileDriver(page) }
      tabs.set(key, created)
      return created
    })
    await Promise.all([...contexts.values()].map((context) => context.close()))
  },
  state: async ({}, use) => {
    await use({})
  },
})

export const { Given, When, Then } = createBdd(test)
