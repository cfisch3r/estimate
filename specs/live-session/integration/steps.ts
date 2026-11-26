import { expect } from '@playwright/test'
import type { CandidateKind, DiagnosticEntry } from '../../../src/domain/diagnosis/types'
import type { Estimate } from '../../../src/domain/estimate'
import type { SessionSnapshot } from '../../../src/domain/types'
import type { Tab, BrowserOptions, ScenarioState } from '../../shared/integration/world'
import { defineParameterType } from 'playwright-bdd'
import { Given, When, Then, requireState } from '../../shared/integration/world'

/** WebRTC needs a few seconds on a busy CI machine; ICE gives up after ~30 s. */
const CONNECT_TIMEOUT = 60_000

const PEER_EVENT = { joined: 'peer-join', left: 'peer-leave' } as const

/** How long a browser's prepared connection offers must have been waiting
 *  before a later browser joins: more than Trystero's offer lifetime (57.3 s). */
const A_MINUTE = 60_000

/** A list of browser names as a feature writes it: `"A"`, `"A" and "B"`,
 *  `"A", "B" and "C"`. One step then fits any number of browsers. */
defineParameterType({
  name: 'browsers',
  regexp: /"[^"]+"(?:(?:, | and )"[^"]+")*/,
  transformer: (text: string) =>
    [...text.matchAll(/"([^"]+)"/g)].map((match) => match[1]!),
})

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
  const joined = await network.join(sessionCode(state, session))
  // Recorded from the start, so a message that arrives before a step looks is
  // still seen.
  for (const listener of ['onSyncState', 'onAnnounce', 'onEstimate'] as const) {
    await joined.listeners.record(listener)
  }
  state.sessions[`${browser}/${tabName}`] = joined.session
  state.listeners[`${browser}/${tabName}`] = joined.listeners
}

function sessionOf(state: ScenarioState, browser: string, tabName = '1') {
  const session = state.sessions[`${browser}/${tabName}`]
  if (!session) throw new Error(`${browser}/${tabName} hasn't joined a session`)
  return session
}

function listenersOf(state: ScenarioState, browser: string, tabName = '1') {
  const listeners = state.listeners[`${browser}/${tabName}`]
  if (!listeners) throw new Error(`${browser}/${tabName} hasn't joined a session`)
  return listeners
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
 *  a browser may offer more (TCP host candidates, for example). "none" means
 *  exactly none. */
function expectListed(recorded: string[], expected: string): void {
  if (expected === 'none') {
    expect(recorded).toEqual([])
    return
  }
  for (const kind of expected.split(',').map((text) => text.trim())) {
    expect(recorded).toContain(kind)
  }
}

/** Waits until every browser's session reaches all the other browsers: its
 *  peer list holds one peer for each of them, so the browsers form a full mesh. */
async function expectAllConnected(state: ScenarioState, browsers: string[]) {
  for (const browser of browsers) {
    await expect
      .poll(
        async () => (await sessionOf(state, browser).getConnectionState()).peerIds.length,
        { timeout: CONNECT_TIMEOUT, message: `${browser} reaches every other browser` },
      )
      .toBe(browsers.length - 1)
  }
}

Given(
  'browsers {browsers} have joined the same session',
  async ({ tab, state }, browsers: string[]) => {
    for (const browser of browsers) await join(tab, state, browser, 'the same')
    // "Have joined" means they are connected, not merely that each asked to.
    await expectAllConnected(state, browsers)
  },
)

When(
  'browsers {browsers} join the same session',
  async ({ tab, state }, browsers: string[]) => {
    for (const browser of browsers) await join(tab, state, browser, 'the same')
  },
)

When(
  'browser {string} joins the same session',
  async ({ tab, state }, browser: string) => {
    await join(tab, state, browser, 'the same')
  },
)

Given(
  'a minute has passed in browsers {browsers}',
  async ({ tab, state }, browsers: string[]) => {
    for (const browser of browsers) {
      // Only a browser already in the session has offers that can go stale; a
      // misspelt name would otherwise move the clock of a fresh, empty page.
      sessionOf(state, browser)
      await (await tab(browser, '1')).moveClockForward(A_MINUTE)
    }
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
  await (await tab(browser, '1')).reload()
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
  "that attempt's selected pair is {string} to {string} or {string}",
  async ({ tab, state }, local: string, remoteKind: string, otherRemoteKind: string) => {
    const { browser, number } = requireState(state, 'attempt')
    const selectedPair = async () => {
      const selected = (await entriesOf(tab, browser)).find(
        (entry) => entry.kind === 'rtc-selected' && entry.attempt === number,
      )
      return selected?.kind === 'rtc-selected'
        ? `${kindText(selected.local)} to ${kindText(selected.remote)}`
        : undefined
    }
    await expect.poll(selectedPair).toBeDefined()
    expect([remoteKind, otherRemoteKind].map((kind) => `${local} to ${kind}`)).toContain(
      await selectedPair(),
    )
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
          // The peer both lines name: what the next step checks.
          state.peer = peersWith(PEER_EVENT[first]).find((peer) => later.includes(peer))
          return state.peer
        },
        { timeout: CONNECT_TIMEOUT },
      )
      .toBeDefined()
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
  'browsers {browsers} are (all )connected to each other',
  async ({ state }, browsers: string[]) => {
    await expectAllConnected(state, browsers)
  },
)

Then(
  "browser {string}'s diagnostics say recording is unavailable",
  async ({ tab }, browser: string) => {
    const { diagnostics } = await tab(browser, '1')
    expect((await diagnostics.read()).available).toBe(false)
  },
)

Then(
  'browser {string} records the join error {string}',
  async ({ tab }, browser: string, error: string) => {
    await expect
      .poll(
        async () =>
          (await entriesOf(tab, browser)).some(
            (entry) => entry.kind === 'join-error' && entry.error.includes(error),
          ),
        { timeout: CONNECT_TIMEOUT },
      )
      .toBe(true)
  },
)

// participant-identity.feature

/** A random UUID: what the storage adapter hands out. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

async function askForParticipantId(
  tab: TabFixture,
  state: ScenarioState,
  browser: string,
  tabName = '1',
): Promise<string> {
  const id = await (
    await tab(browser, tabName)
  ).participantIdentity.getOrCreateParticipantId()
  state.participantIds.push(id)
  return id
}

Given(
  'browser {string} has a participant id',
  async ({ tab, state }, browser: string) => {
    expect(await askForParticipantId(tab, state, browser)).toMatch(UUID)
  },
)

Then(
  'browser {string} has the same participant id',
  async ({ tab, state }, browser: string) => {
    const [first] = state.participantIds
    expect(await askForParticipantId(tab, state, browser)).toBe(first)
  },
)

for (const text of [
  'tab {string} of browser {string} has a participant id',
  'tab {string} of browser {string} asks for a participant id',
]) {
  Given(text, async ({ tab, state }, tabName: string, browser: string) => {
    expect(await askForParticipantId(tab, state, browser, tabName)).toMatch(UUID)
  })
}

Then('both tabs have the same participant id', ({ state }) => {
  const [first, second] = state.participantIds
  expect(state.participantIds).toHaveLength(2)
  expect(second).toBe(first)
})

When(
  'browser {string} asks for a participant id twice',
  async ({ tab, state }, browser: string) => {
    await askForParticipantId(tab, state, browser)
    await askForParticipantId(tab, state, browser)
  },
)

Then('it gets a participant id both times', ({ state }) => {
  expect(state.participantIds).toHaveLength(2)
  for (const id of state.participantIds) expect(id).toMatch(UUID)
})

Then('the two ids differ', ({ state }) => {
  const [first, second] = state.participantIds
  expect(second).not.toBe(first)
})

// facilitator-snapshots.feature

/** The facilitator's participant id: `FACILITATOR_PARTICIPANT_ID` in the
 *  domain, written out because integration steps take only types from src/. */
const FACILITATOR = 'facilitator'

/** A snapshot whose only distinguishing content is its item's title. */
function snapshotOf(title: string): SessionSnapshot {
  return {
    currentItem: { id: title.toLowerCase(), title, description: '' },
    sessionName: '',
    unit: 'days',
    revealed: false,
    round: 0,
    roster: [],
    submissions: [],
    finalizedItemIds: [],
    finalResult: null,
  }
}

/** Every browser in the scenario apart from `browser`. */
function othersOf(state: ScenarioState, browser: string): string[] {
  return Object.keys(state.sessions)
    .map((key) => key.split('/')[0]!)
    .filter((other) => other !== browser)
}

async function announcesOf(state: ScenarioState, browser: string) {
  return (await listenersOf(state, browser).delivered('onAnnounce')).map(
    ([announce, peerId]) => ({ participantId: announce.participantId, peerId }),
  )
}

/** Waits until `browser` has the announce with `participantId`, and gives the
 *  peer that sent it. */
async function waitForAnnounce(
  state: ScenarioState,
  browser: string,
  participantId: string,
): Promise<string> {
  await expect
    .poll(
      async () =>
        (await announcesOf(state, browser)).some(
          (announce) => announce.participantId === participantId,
        ),
      { timeout: CONNECT_TIMEOUT, message: `${browser} has ${participantId}'s announce` },
    )
    .toBe(true)
  const announce = (await announcesOf(state, browser)).find(
    (each) => each.participantId === participantId,
  )
  return announce!.peerId
}

async function snapshotTitlesOf(state: ScenarioState, browser: string) {
  return (await listenersOf(state, browser).delivered('onSyncState')).map(
    ([snapshot]) => snapshot.currentItem?.title,
  )
}

async function announce(
  state: ScenarioState,
  browser: string,
  participantId: string,
): Promise<void> {
  await sessionOf(state, browser).sendAnnounce({ participantId, name: browser })
  state.lastAnnounce = participantId
}

Given(
  'browser {string} has announced itself as the facilitator',
  async ({ state }, browser: string) => {
    await announce(state, browser, FACILITATOR)
    for (const other of othersOf(state, browser)) {
      await waitForAnnounce(state, other, FACILITATOR)
    }
  },
)

Given(
  'browser {string} answers snapshot requests with the item {string}',
  async ({ state }, browser: string, title: string) => {
    await listenersOf(state, browser).answerWith('onRequestSnapshot', snapshotOf(title))
  },
)

When(
  'browser {string} sends a snapshot of the item {string}',
  async ({ state }, browser: string, title: string) => {
    await sessionOf(state, browser).sendSyncState(snapshotOf(title))
  },
)

When(
  'browser {string} sends a snapshot of the item {string}, then announces itself as {}',
  async ({ state }, browser: string, title: string, who: string) => {
    await sessionOf(state, browser).sendSyncState(snapshotOf(title))
    await announce(
      state,
      browser,
      who === 'the facilitator' ? FACILITATOR : browser.toLowerCase(),
    )
  },
)

When(
  'browser {string} sends an estimate for the item {string}',
  async ({ state }, browser: string, title: string) => {
    const facilitator = await waitForAnnounce(state, browser, FACILITATOR)
    // A plain estimate: the adapter parses it back through `createEstimate`.
    const estimate = {
      participantId: browser.toLowerCase(),
      best: 1,
      likely: 2,
      worst: 4,
    }
    await sessionOf(state, browser).sendEstimate(
      title.toLowerCase(),
      estimate as Estimate,
      0,
      facilitator,
    )
  },
)

When(
  'browser {string} asks the facilitator for a snapshot',
  async ({ state }, browser: string) => {
    const facilitator = await waitForAnnounce(state, browser, FACILITATOR)
    state.pulledSnapshot = await sessionOf(state, browser).requestSnapshot(facilitator)
  },
)

Then(
  'browser {string} takes the snapshot of {string}',
  async ({ state }, browser: string, title: string) => {
    await expect
      .poll(() => snapshotTitlesOf(state, browser), { timeout: CONNECT_TIMEOUT })
      .toContain(title)
  },
)

Then(
  'browser {string} takes no snapshot of {string}',
  async ({ state }, browser: string, title: string) => {
    // The snapshot was sent before the announce, so it has arrived by now.
    await waitForAnnounce(state, browser, requireState(state, 'lastAnnounce'))
    expect(await snapshotTitlesOf(state, browser)).not.toContain(title)
  },
)

Then(
  'browser {string} gets the estimate for {string}',
  async ({ state }, browser: string, title: string) => {
    const itemIds = async () =>
      (await listenersOf(state, browser).delivered('onEstimate')).map(
        ([itemId]) => itemId,
      )
    await expect
      .poll(itemIds, { timeout: CONNECT_TIMEOUT })
      .toContain(title.toLowerCase())
  },
)

Then(
  'browser {string} gets the snapshot of {string}',
  ({ state }, _browser: string, title: string) => {
    expect(requireState(state, 'pulledSnapshot').currentItem?.title).toBe(title)
  },
)
