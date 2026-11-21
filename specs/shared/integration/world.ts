import { readFile } from 'node:fs/promises'
import type { Browser, BrowserContext, Page } from '@playwright/test'
import { test as base, createBdd } from 'playwright-bdd'
import type { DiagnosticsLog } from '../../../src/application/ports/outbound/diagnosticsLog'
import type { DiagnosticEntry } from '../../../src/domain/diagnosis/types'
import type { FileDownloadApi } from '../../../src/application/ports/outbound/fileDownload'
import type {
  JoinSession,
  TransportSession,
} from '../../../src/application/ports/outbound/networkTransport'
import { joinInPage, remote, remoteHandle } from './remote'
import type { Remote } from './remote'

/** A file the browser actually saved, as Playwright's `download` event saw it. */
export type SavedFile = { suggestedName: string; bytes: Buffer }

/** The file adapter, driven through its port. Its parameters come from the
 *  port; only the result is hand-written, because besides calling the port it
 *  waits for the browser's real `download` event. */
export type FileDriver = {
  download(...args: Parameters<Remote<FileDownloadApi>['download']>): Promise<SavedFile>
}

/** The network adapter, driven through its port: `join` opens a session in the
 *  page and returns a driver for it, typed from `TransportSession`. */
export type NetworkDriver = {
  join(...args: Parameters<JoinSession>): Promise<Remote<TransportSession>>
}

/** One tab of one browser: tabs of the same browser share a context (and so
 *  share storage), different browsers never do. */
export type Tab = {
  page: Page
  /** Reloads the page and waits until the harness is installed again. */
  reload: () => Promise<void>
  /** Moves the page's clock (`Date.now()`) forward by `ms` without firing any
   *  timer early, as if the page had been open that much longer. */
  moveClockForward: (ms: number) => Promise<void>
  files: FileDriver
  diagnostics: Remote<DiagnosticsLog>
  network: NetworkDriver
}

/** How a browser differs from a plain one. Set when its first tab opens. */
export type BrowserOptions = {
  /** False launches a Chromium that opens no direct (non-proxied UDP)
   *  connections, so a WebRTC attempt with it fails for real (ADR-011: a fault
   *  through the browser, never a stub). */
  directConnections?: boolean
  /** 'refuses-writes' makes every `localStorage.setItem` throw, as a full or
   *  blocked storage does. */
  storage?: 'refuses-writes'
}

/** Chromium's policy for WebRTC without a proxy: no non-proxied UDP at all. */
const NO_DIRECT_CONNECTIONS = '--force-webrtc-ip-handling-policy=disable_non_proxied_udp'

/** Mutable state for one scenario, scoped per test. */
export type ScenarioState = {
  /** The file the last download step saved. */
  savedFile?: SavedFile
  /** Session codes by the name a scenario gives them ("the same", "one", …). */
  sessionCodes: Record<string, string>
  /** The open session of each tab, keyed `<browser>/<tab>`. */
  sessions: Record<string, Remote<TransportSession>>
  /** The WebRTC attempt the last "records a WebRTC attempt" step found. */
  attempt?: { browser: string; number: number }
  /** The peer the last "records a peer" step found. */
  peer?: string
  /** The entries the last "diagnostics read in tab" step read. */
  entries?: DiagnosticEntry[]
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

/** The harness installs `window.__harness` once its module has loaded, which
 *  can be after the `load` event that `goto` waits for. */
async function waitForHarness(page: Page): Promise<void> {
  await page.waitForFunction(() => '__harness' in globalThis)
}

/** Playwright's clock, installed on the open page and left running in real
 *  time; `setSystemTime` then jumps `Date.now()` ahead without running the
 *  timers that fall due in between. The check afterwards makes sure the jump
 *  reached the page, so a clock that didn't take over fails here, not as a
 *  spec that passes without having moved anything. */
async function moveClockForward(page: Page, ms: number): Promise<void> {
  const before = await page.evaluate(() => Date.now())
  await page.clock.install()
  await page.clock.setSystemTime(before + ms)
  const after = await page.evaluate(() => Date.now())
  if (after < before + ms) {
    throw new Error(
      `the page's clock didn't move: ${after - before} ms instead of ${ms} ms`,
    )
  }
}

function networkDriver(page: Page): NetworkDriver {
  return {
    async join(...args) {
      return remoteHandle(await joinInPage(page, ...args))
    },
  }
}

type Fixtures = {
  tab: (browser: string, tab: string, options?: BrowserOptions) => Promise<Tab>
  state: ScenarioState
}

export const test = base.extend<Fixtures>({
  tab: async ({ browser, playwright }, use) => {
    const launched: Browser[] = []
    const contexts = new Map<string, BrowserContext>()
    const tabs = new Map<string, Tab>()

    const newContext = async (options: BrowserOptions) => {
      let owner = browser
      if (options.directConnections === false) {
        owner = await playwright.chromium.launch({ args: [NO_DIRECT_CONNECTIONS] })
        launched.push(owner)
      }
      // The launched browser doesn't inherit the project's `baseURL`.
      const context = await owner.newContext({
        acceptDownloads: true,
        baseURL: test.info().project.use.baseURL,
      })
      if (options.storage === 'refuses-writes') {
        await context.addInitScript(() => {
          Storage.prototype.setItem = () => {
            throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
          }
        })
      }
      return context
    }

    await use(async (browserName, tabName, options = {}) => {
      const key = `${browserName}/${tabName}`
      const existing = tabs.get(key)
      if (existing) return existing
      let context = contexts.get(browserName)
      if (!context) {
        context = await newContext(options)
        contexts.set(browserName, context)
      }
      const page = await context.newPage()
      // The project's `baseURL` is the harness page (playwright.config.ts).
      await page.goto('/')
      await waitForHarness(page)
      const created = {
        page,
        reload: async () => {
          await page.reload()
          await waitForHarness(page)
        },
        moveClockForward: (ms: number) => moveClockForward(page, ms),
        files: fileDriver(page),
        diagnostics: remote(page, 'diagnostics'),
        network: networkDriver(page),
      }
      tabs.set(key, created)
      return created
    })
    await Promise.all([...contexts.values()].map((context) => context.close()))
    await Promise.all(launched.map((owner) => owner.close()))
  },
  state: async ({}, use) => {
    await use({ sessionCodes: {}, sessions: {} })
  },
})

export const { Given, When, Then } = createBdd(test)
