import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Browser, BrowserContext, Download, Page } from '@playwright/test'
import { test as base, createBdd } from 'playwright-bdd'
import type { DiagnosticsLog } from '../../../src/application/ports/outbound/diagnosticsLog'
import type { DiagnosticEntry } from '../../../src/domain/diagnosis/types'
import type { Result } from '../../../src/domain/estimate'
import type { SavedSession } from '../../../src/domain/savedSession'
import type { FileDownloadApi } from '../../../src/application/ports/outbound/fileDownload'
import type {
  JoinSession,
  TransportSession,
} from '../../../src/application/ports/outbound/networkTransport'
import type {
  PickedFile,
  SessionFileApi,
  SessionFileRejection,
} from '../../../src/application/ports/outbound/sessionFiles'
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

/** A file the user picks: its name and bytes, or a file that was deleted after
 *  it was picked, so the browser can no longer read it. */
export type PickFile = { name: string; bytes: Buffer } | { deletedAfterPicking: true }

/** The session-file adapter, driven through its port. Hand-written, because a
 *  picked `File` can't cross from Node into the page: `open` picks the file in
 *  the harness page's file input and opens what the input holds, so the
 *  adapter reads a real browser `File`. `save` also waits for the browser's
 *  real `download` event. */
export type SessionFileDriver = {
  save(
    ...args: Parameters<Remote<SessionFileApi>['save']>
  ): Promise<{ fileName: string; savedFile: SavedFile }>
  open(file: PickFile): Promise<Result<SavedSession, SessionFileRejection>>
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
  /** Moves the clock (`Date.now()`) of this tab's browser forward by `ms`
   *  without firing any timer early, as if the browser had been open that much
   *  longer. Playwright's clock belongs to the browser context, so every tab of
   *  the browser moves with it. */
  moveClockForward: (ms: number) => Promise<void>
  files: FileDriver
  sessionFiles: SessionFileDriver
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
  /** The saved session the next "saves it" step saves. */
  savedSession?: SavedSession
  /** What the last session-file save returned and the browser saved. */
  sessionFileSave?: { fileName: string; savedFile: SavedFile }
  /** The file the next "opens it" step opens. */
  pick?: PickFile
  /** The text of the last file the user opened, when a step wrote it. */
  openedText?: string
  /** What the last session-file open gave back. */
  opened?: Result<SavedSession, SessionFileRejection>
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
      return savedFileOf(download)
    },
  }
}

async function savedFileOf(download: Download): Promise<SavedFile> {
  return {
    suggestedName: download.suggestedFilename(),
    bytes: await readFile(await download.path()),
  }
}

/** Sets the harness page's file input to a real file on disk, then deletes the
 *  file: the input keeps a `File` whose bytes the browser can no longer read
 *  (ADR-011: a fault through the browser, never a stub). */
async function pickDeletedFile(page: Page): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'estimate-pick-'))
  const path = join(directory, 'gone.estimate.json')
  await writeFile(path, '{}')
  await page.setInputFiles('#picker', path)
  await rm(directory, { recursive: true })
}

function sessionFileDriver(page: Page): SessionFileDriver {
  const port = remote(page, 'sessionFiles')
  return {
    async save(...args) {
      const [download, fileName] = await Promise.all([
        page.waitForEvent('download'),
        port.save(...args),
      ])
      return { fileName, savedFile: await savedFileOf(download) }
    },
    async open(file) {
      if ('deletedAfterPicking' in file) {
        await pickDeletedFile(page)
      } else {
        await page.setInputFiles('#picker', {
          name: file.name,
          mimeType: 'application/json',
          buffer: file.bytes,
        })
      }
      // Node has no DOM types: the input is typed by what the step reads off it.
      return page.locator('#picker').evaluate((input) => {
        const picked = (input as unknown as { files: ArrayLike<PickedFile> | null })
          .files?.[0]
        const open = (
          globalThis as unknown as {
            __harness?: { sessionFiles?: Pick<SessionFileApi, 'open'> }
          }
        ).__harness?.sessionFiles?.open
        if (!picked || !open) {
          throw new Error(
            'No picked file, or window.__harness.sessionFiles is not installed',
          )
        }
        return open(picked)
      })
    },
  }
}

/** The harness installs `window.__harness` once its module has loaded, which
 *  can be after the `load` event that `goto` waits for. */
async function waitForHarness(page: Page): Promise<void> {
  await page.waitForFunction(() => '__harness' in globalThis)
}

/** Browser contexts whose clock is already installed: Playwright's clock
 *  belongs to the context, and installing it twice would fail. */
const clockInstalled = new WeakSet<BrowserContext>()

/** Installs Playwright's clock on the tab's browser once, left running in real
 *  time; `setSystemTime` then jumps `Date.now()` ahead without running the
 *  timers that fall due in between. The check afterwards makes sure the jump
 *  reached the page, so a clock that didn't take over fails here, not as a
 *  spec that passes without having moved anything. */
async function moveClockForward(page: Page, ms: number): Promise<void> {
  const before = await page.evaluate(() => Date.now())
  const context = page.context()
  if (!clockInstalled.has(context)) {
    await page.clock.install()
    clockInstalled.add(context)
  }
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
        sessionFiles: sessionFileDriver(page),
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
