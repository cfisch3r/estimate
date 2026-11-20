import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDiagnosticsLog } from './diagnosticsLog'

const PREFIX = 'estimate.diagnostics.'

/** A clock that ticks one second per call, so entries sort predictably. */
function clock(start = 0) {
  let second = start
  return () => new Date(Date.UTC(2026, 10, 20, 10, 0, second++)).toISOString()
}

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('createDiagnosticsLog', () => {
  it('reads back what it recorded, with time and tab', () => {
    const log = createDiagnosticsLog({ tabId: 'tab1', now: clock(), userAgent: 'UA' })

    log.record({ kind: 'status', status: 'connecting' })

    expect(log.read()).toEqual({
      available: true,
      userAgent: 'UA',
      entries: [
        {
          kind: 'status',
          status: 'connecting',
          at: '2026-11-20T10:00:00.000Z',
          tab: 'tab1',
        },
      ],
    })
  })

  it('keeps each tab under its own key, and reads every tab in time order', () => {
    const now = clock()
    const first = createDiagnosticsLog({ tabId: 'one', now })
    const second = createDiagnosticsLog({ tabId: 'two', now })

    first.record({ kind: 'peer-join', peer: 'aaaaaa' })
    second.record({ kind: 'peer-join', peer: 'bbbbbb' })
    first.record({ kind: 'peer-leave', peer: 'aaaaaa' })

    expect(Object.keys(localStorage).sort()).toEqual([`${PREFIX}one`, `${PREFIX}two`])
    const tabs = (log: typeof first) => log.read().entries.map((entry) => entry.tab)
    expect(tabs(first)).toEqual(['one', 'two', 'one'])
    expect(tabs(second)).toEqual(['one', 'two', 'one'])
  })

  it('reads only the newest 500 entries across tabs', () => {
    const now = clock()
    const other = createDiagnosticsLog({ tabId: 'other', now })
    other.record({ kind: 'peer-join', peer: 'oldest' })
    const log = createDiagnosticsLog({ tabId: 'mine', now })
    for (let i = 0; i < 500; i++) log.record({ kind: 'status', status: 'connected' })

    const { entries } = log.read()
    expect(entries).toHaveLength(500)
    expect(entries.some((entry) => entry.tab === 'other')).toBe(false)
  })

  it("never writes another tab's key while recording", () => {
    const now = clock()
    const other = createDiagnosticsLog({ tabId: 'other', now })
    other.record({ kind: 'peer-join', peer: 'oldest' })
    const log = createDiagnosticsLog({ tabId: 'mine', now })
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem')

    for (let i = 0; i < 501; i++) log.record({ kind: 'status', status: 'connected' })

    const touched = [...setItem.mock.calls, ...removeItem.mock.calls].map(([key]) => key)
    expect(new Set(touched)).toEqual(new Set([`${PREFIX}mine`]))
    expect(localStorage.getItem(`${PREFIX}other`)).not.toBeNull()
  })

  it('keeps at most 500 entries under its own key', () => {
    const log = createDiagnosticsLog({ tabId: 'mine', now: clock() })
    for (let i = 0; i < 501; i++) log.record({ kind: 'status', status: 'connected' })

    expect(JSON.parse(localStorage.getItem(`${PREFIX}mine`) ?? '[]')).toHaveLength(500)
  })

  it('removes, when a tab opens, the tabs whose entries are all too old to be read', () => {
    const now = clock()
    createDiagnosticsLog({ tabId: 'old', now }).record({ kind: 'peer-join', peer: 'old' })
    const busy = createDiagnosticsLog({ tabId: 'busy', now })
    for (let i = 0; i < 500; i++) busy.record({ kind: 'status', status: 'connected' })

    createDiagnosticsLog({ tabId: 'new', now })

    expect(localStorage.getItem(`${PREFIX}old`)).toBeNull()
    expect(localStorage.getItem(`${PREFIX}busy`)).not.toBeNull()
  })

  it('clears every tab and nothing else', () => {
    localStorage.setItem('estimate.participantId', 'kept')
    const log = createDiagnosticsLog({ tabId: 'one', now: clock() })
    createDiagnosticsLog({ tabId: 'two', now: clock() }).record({
      kind: 'peer-join',
      peer: 'bbbbbb',
    })
    log.record({ kind: 'peer-join', peer: 'aaaaaa' })

    log.clear()

    expect(log.read().entries).toEqual([])
    expect(Object.keys(localStorage)).toEqual(['estimate.participantId'])
  })

  it('skips a stored value that is not a list of entries', () => {
    localStorage.setItem(`${PREFIX}broken`, '{not json')
    localStorage.setItem(`${PREFIX}object`, '{"kind":"status"}')
    const log = createDiagnosticsLog({ tabId: 'one', now: clock() })
    log.record({ kind: 'peer-join', peer: 'aaaaaa' })

    expect(log.read().entries.map((entry) => entry.tab)).toEqual(['one'])
  })

  it('records nothing, and says so, when storage refuses writes', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
    })
    const log = createDiagnosticsLog({ tabId: 'one', now: clock() })

    expect(() => log.record({ kind: 'peer-join', peer: 'aaaaaa' })).not.toThrow()
    expect(log.read()).toMatchObject({ available: false, entries: [] })
  })

  it('stops recording when a write fails later on', () => {
    const log = createDiagnosticsLog({ tabId: 'one', now: clock() })
    log.record({ kind: 'peer-join', peer: 'aaaaaa' })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
    })

    expect(() => log.record({ kind: 'peer-leave', peer: 'aaaaaa' })).not.toThrow()
    expect(log.read().available).toBe(false)
  })

  it('says it is unavailable when storage becomes unreachable', () => {
    let reachable = true
    const log = createDiagnosticsLog({
      storage: () => {
        if (!reachable) throw new DOMException('blocked', 'SecurityError')
        return localStorage
      },
    })
    reachable = false

    expect(log.read()).toMatchObject({ available: false, entries: [] })
  })

  it('works without storage at all', () => {
    const log = createDiagnosticsLog({
      storage: () => {
        throw new DOMException('blocked', 'SecurityError')
      },
    })

    expect(() => log.record({ kind: 'peer-join', peer: 'aaaaaa' })).not.toThrow()
    expect(() => log.clear()).not.toThrow()
    expect(log.read()).toMatchObject({ available: false, entries: [] })
  })

  it('defaults to a random tab id, the current time and the browser user agent', () => {
    const log = createDiagnosticsLog()
    log.record({ kind: 'peer-join', peer: 'aaaaaa' })

    const [entry] = log.read().entries
    expect(entry?.tab).toMatch(/^[a-z0-9]{4}$/)
    expect(Date.parse(entry?.at ?? '')).not.toBeNaN()
    expect(log.read().userAgent).toBe(navigator.userAgent)
  })
})
