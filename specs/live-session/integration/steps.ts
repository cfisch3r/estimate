import { expect } from '@playwright/test'
import type { CandidateKind, DiagnosticEntry } from '../../../src/domain/diagnosis/types'
import type { Tab, BrowserOptions, ScenarioState } from '../../shared/integration/world'
import { Given, When, Then, requireState } from '../../shared/integration/world'

/** WebRTC needs a few seconds on a busy CI machine; ICE gives up after ~30 s. */
const CONNECT_TIMEOUT = 60_000

const PEER_EVENT = { joined: 'peer-join', left: 'peer-leave' } as const

type TabFixture = (browser: string, tab: string, options?: BrowserOptions) => Promise<Tab>

/** A fresh code per scenario and session name: the local relay is shared by
 *  every worker, so two scenarios must never meet in one room. Its value is
 *  incidental, so the feature never names it. */
function sessionCode(state: ScenarioState, name: string): string {
  state.sessionCodes[name] ??= Math.random().toString(36).slice(2, 8).toUpperCase()
  return state.sessionCodes[name]
}

async function join(
  tab: TabFixture,
  state: ScenarioState,
  browser: string,
  session: string,
  { tabName = '1', options }: { tabName?: string; options?: BrowserOptions } = {},
): Promise<void> {
  const { network } = await tab(browser, tabName, options)
  state.sessions[`${browser}/${tabName}`] = await network.join(
    sessionCode(state, session),
  )
}

function sessionOf(state: ScenarioState, browser: string, tabName = '1') {
  const session = state.sessions[`${browser}/${tabName}`]
  if (!session) throw new Error(`${browser}/${tabName} hasn't joined a session`)
  return session
}

async function entriesOf(tab: TabFixture, browser: string, tabName = '1') {
  const { diagnostics } = await tab(browser, tabName)
  return (await diagnostics.read()).entries
}

/** `host/udp`, the form the feature names candidates in. */
const kindText = ({ type, protocol }: CandidateKind) => `${type}/${protocol}`

/** The kinds an attempt recorded for one side, as `host/udp` texts. */
function candidatesOf(
  entries: DiagnosticEntry[],
  attempt: number,
  side: 'local' | 'remote',
): string[] {
  return entries.flatMap((entry) =>
    entry.kind === 'rtc-candidates' && entry.attempt === attempt && entry.side === side
      ? entry.candidates.map(kindText)
      : [],
  )
}

/** "lists candidates X, Y" means each of X and Y is among the recorded kinds:
 *  a browser may offer more (TCP host candidates, for example). */
function expectListed(recorded: string[], expected: string): void {
  for (const kind of expected.split(',').map((text) => text.trim())) {
    expect(recorded).toContain(kind)
  }
}

Given(
  'browsers {string} and {string} have joined the same session',
  async ({ tab, state }, first: string, second: string) => {
    await join(tab, state, first, 'the same')
    await join(tab, state, second, 'the same')
  },
)

When(
  'browsers {string} and {string} join the same session',
  async ({ tab, state }, first: string, second: string) => {
    await join(tab, state, first, 'the same')
    await join(tab, state, second, 'the same')
  },
)

Given(
  'browser {string} has joined a session',
  async ({ tab, state }, browser: string) => {
    await join(tab, state, browser, 'the same')
  },
)

Given(
  'browser {string} has joined the same session without direct connections',
  async ({ tab, state }, browser: string) => {
    await join(tab, state, browser, 'the same', { options: { directConnections: false } })
  },
)

Given(
  'tab {string} of browser {string} and browser {string} have joined {word} session',
  async (
    { tab, state },
    tabName: string,
    browser: string,
    other: string,
    session: string,
  ) => {
    await join(tab, state, browser, session, { tabName })
    await join(tab, state, other, session)
  },
)

Given(
  'browser {string}, whose storage refuses every write',
  async ({ tab }, browser: string) => {
    await tab(browser, '1', { storage: 'refuses-writes' })
  },
)

When('browser {string} leaves the session', async ({ state }, browser: string) => {
  await sessionOf(state, browser).leave()
})

When('browser {string} reloads the page', async ({ tab }, browser: string) => {
  const { page } = await tab(browser, '1')
  await page.reload()
})

Then(
  'browser {string} records a WebRTC attempt that ended {string}',
  async ({ tab, state }, browser: string, outcome: string) => {
    await expect
      .poll(
        async () => {
          const ended = (await entriesOf(tab, browser)).find(
            (entry) => entry.kind === 'rtc-state' && entry.connectionState === outcome,
          )
          return ended?.kind === 'rtc-state' ? ended.attempt : undefined
        },
        { timeout: CONNECT_TIMEOUT },
      )
      .toBeDefined()
    const ended = (await entriesOf(tab, browser)).find(
      (entry) => entry.kind === 'rtc-state' && entry.connectionState === outcome,
    )
    if (ended?.kind !== 'rtc-state') throw new Error('the attempt disappeared')
    state.attempt = { browser, number: ended.attempt }
  },
)

Then(
  'that attempt lists local candidates {string} and remote candidates {string}',
  async ({ tab, state }, local: string, remoteKinds: string) => {
    const { browser, number } = requireState(state, 'attempt')
    const entries = await entriesOf(tab, browser)
    expectListed(candidatesOf(entries, number, 'local'), local)
    expectListed(candidatesOf(entries, number, 'remote'), remoteKinds)
  },
)

Then(
  'that attempt lists local candidates {string}',
  async ({ tab, state }, local: string) => {
    const { browser, number } = requireState(state, 'attempt')
    expectListed(candidatesOf(await entriesOf(tab, browser), number, 'local'), local)
  },
)

Then(
  "that attempt's selected pair is {string} to {string}",
  async ({ tab, state }, local: string, remoteKind: string) => {
    const { browser, number } = requireState(state, 'attempt')
    await expect
      .poll(async () => {
        const selected = (await entriesOf(tab, browser)).find(
          (entry) => entry.kind === 'rtc-selected' && entry.attempt === number,
        )
        return selected?.kind === 'rtc-selected'
          ? `${kindText(selected.local)} to ${kindText(selected.remote)}`
          : undefined
      })
      .toBe(`${local} to ${remoteKind}`)
  },
)

Then(
  "browser {string}'s diagnostics contain no IP address and no host name",
  async ({ tab }, browser: string) => {
    // `at` holds a time ("12:34:56"), which would read as an IPv6 fragment.
    const recorded = JSON.stringify(
      (await entriesOf(tab, browser)).map(({ at: _at, ...entry }) => entry),
    )
    expect(recorded).not.toMatch(/\b\d{1,3}(\.\d{1,3}){3}\b/)
    expect(recorded).not.toMatch(/\b[0-9a-f]{0,4}(:[0-9a-f]{0,4}){2,7}\b/i)
    expect(recorded).not.toMatch(/\.local\b/)
  },
)

Then(
  'browser {string} records a peer {string} and the same peer {string}',
  async (
    { tab, state },
    browser: string,
    first: keyof typeof PEER_EVENT,
    second: keyof typeof PEER_EVENT,
  ) => {
    await expect
      .poll(
        async () => {
          const entries = await entriesOf(tab, browser)
          const peersWith = (kind: string) =>
            entries.flatMap((entry) =>
              entry.kind === kind && 'peer' in entry && entry.peer ? [entry.peer] : [],
            )
          const later = peersWith(PEER_EVENT[second])
          return peersWith(PEER_EVENT[first]).find((peer) => later.includes(peer))
        },
        { timeout: CONNECT_TIMEOUT },
      )
      .toBeDefined()
    const entries = await entriesOf(tab, browser)
    const joined = entries.find((entry) => entry.kind === PEER_EVENT[first])
    state.peer = joined && 'peer' in joined ? joined.peer : undefined
  },
)

Then(
  'both lines name the peer by a {int}-character id',
  async ({ state }, length: number) => {
    expect(requireState(state, 'peer')).toHaveLength(length)
  },
)

Then(
  "browser {string}'s diagnostics still record a peer {string}",
  async ({ tab }, browser: string, event: keyof typeof PEER_EVENT) => {
    const entries = await entriesOf(tab, browser)
    expect(entries.some((entry) => entry.kind === PEER_EVENT[event])).toBe(true)
  },
)

Then(
  'the diagnostics read in tab {string} hold the entries of tabs {string} and {string}',
  async ({ tab, state }, reader: string, _first: string, _second: string) => {
    // The log labels entries by its own random tab id, which the steps can't
    // know, so "both tabs" means: peer joins recorded under two tab labels.
    await expect
      .poll(
        async () => {
          const entries = await entriesOf(tab, 'A', reader)
          return new Set(
            entries
              .filter((entry) => entry.kind === 'peer-join')
              .map((entry) => entry.tab),
          ).size
        },
        { timeout: CONNECT_TIMEOUT },
      )
      .toBe(2)
    state.entries = await entriesOf(tab, 'A', reader)
  },
)

Then(
  'the diagnostics read in tab {string} hold the same entries',
  async ({ tab, state }, reader: string) => {
    expect(await entriesOf(tab, 'A', reader)).toEqual(requireState(state, 'entries'))
  },
)

Then(
  'browsers {string} and {string} are connected to each other',
  async ({ state }, first: string, second: string) => {
    for (const browser of [first, second]) {
      await expect
        .poll(async () => (await sessionOf(state, browser).getConnectionState()).status, {
          timeout: CONNECT_TIMEOUT,
        })
        .toBe('connected')
    }
  },
)

Then(
  "browser {string}'s diagnostics say recording is unavailable",
  async ({ tab }, browser: string) => {
    const { diagnostics } = await tab(browser, '1')
    expect((await diagnostics.read()).available).toBe(false)
  },
)
