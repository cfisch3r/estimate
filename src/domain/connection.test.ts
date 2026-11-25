import { describe, expect, it } from 'vitest'
import {
  deriveConnectionStatus,
  facilitatorStart,
  announcementFor,
  leaveConfirmation,
  shouldBroadcastSnapshot,
  participantJoin,
  screenAccessFor,
} from './connection'
import type { ScreenAccessState } from './connection'
import type { ConnectionStatus, SessionRole } from './types'

const STATUSES: ConnectionStatus[] = ['connecting', 'connected', 'disconnected']

describe('deriveConnectionStatus', () => {
  it.each(STATUSES.filter((s) => s !== 'connected'))(
    'passes a participant %s status through unchanged',
    (status) => {
      expect(deriveConnectionStatus('participant', status, false)).toBe(status)
      expect(deriveConnectionStatus('participant', status, true)).toBe(status)
    },
  )

  it.each(STATUSES)('passes a facilitator %s status through unchanged', (status) => {
    const role: SessionRole = 'facilitator'
    expect(deriveConnectionStatus(role, status, false)).toBe(status)
    expect(deriveConnectionStatus(role, status, true)).toBe(status)
  })
})

describe('facilitatorStart', () => {
  it('enters a live facilitator session that is still connecting', () => {
    expect(facilitatorStart('K7F9Q2')).toEqual({
      mode: 'live',
      role: 'facilitator',
      sessionId: 'K7F9Q2',
      myName: 'Facilitator',
      participantNames: { facilitator: 'Facilitator' },
      connectionStatus: 'connecting',
      hasEverConnected: false,
      peerCount: 0,
    })
  })
})

describe('participantJoin', () => {
  it('normalises the code, trims the name and seeds the own name against the id', () => {
    expect(participantJoin(' k7f9q2 ', '  Sam  ', 'p-1')).toEqual({
      mode: 'live',
      role: 'participant',
      sessionId: 'K7F9Q2',
      myName: 'Sam',
      participantId: 'p-1',
      participantNames: { 'p-1': 'Sam' },
      connectionStatus: 'connecting',
      hasEverConnected: false,
      peerCount: 0,
    })
  })
})

describe('leaveConfirmation', () => {
  // The rule itself is specified in specs/live-session/domain/leaving.feature.
  // Manual mode never has peers; whether this check is needed is open (#248).
  it('asks nothing for a Manual session, whatever the peer count', () => {
    expect(leaveConfirmation('manual', 3, false)).toBe('none')
  })
})

describe('shouldBroadcastSnapshot', () => {
  it('is true only for a facilitator hosting a live session with a code', () => {
    expect(shouldBroadcastSnapshot('live', 'facilitator', 'K7F9Q2')).toBe(true)
  })

  it.each([
    ['manual', 'facilitator', 'K7F9Q2'],
    ['live', 'participant', 'K7F9Q2'],
    ['live', 'facilitator', null],
    ['live', 'facilitator', ''],
  ] as const)('is false for mode %s, role %s, code %j', (mode, role, sessionId) => {
    expect(shouldBroadcastSnapshot(mode, role, sessionId)).toBe(false)
  })
})

describe('screenAccessFor', () => {
  const state = (overrides: Partial<ScreenAccessState> = {}): ScreenAccessState => ({
    mode: 'manual',
    role: 'facilitator',
    sessionId: null,
    hasEverConnected: false,
    started: false,
    ...overrides,
  })
  const participant = (overrides: Partial<ScreenAccessState> = {}) =>
    state({ mode: 'live', role: 'participant', sessionId: 'K7F9Q2', ...overrides })
  const facilitator = state({ mode: 'live', sessionId: 'K7F9Q2', started: true })

  it.each([
    // Workspace: a live participant belongs on their estimate screen.
    ['a live participant', participant(), 'workspace', 'estimate'],
    ['a live facilitator', facilitator, 'workspace', 'allow'],
    ['a single user', state(), 'workspace', 'allow'],
    ['a participant who left', state({ role: 'participant' }), 'workspace', 'allow'],
    // Estimate screen: only a participant with a joined session.
    ['a visitor with no session', state(), 'estimate', 'modeSelect'],
    ['a live facilitator', facilitator, 'estimate', 'workspace'],
    ['a joined participant', participant(), 'estimate', 'allow'],
    // Entry screens: a running session goes back to its own screen.
    [
      'a connected participant',
      participant({ hasEverConnected: true }),
      'modeSelect',
      'estimate',
    ],
    [
      'a connected participant',
      participant({ hasEverConnected: true }),
      'join',
      'estimate',
    ],
    ['a participant still joining', participant(), 'modeSelect', 'join'],
    ['a participant still joining', participant(), 'join', 'allow'],
    ['a participant who left', state({ role: 'participant' }), 'modeSelect', 'allow'],
    ['a started session', state({ started: true }), 'modeSelect', 'workspace'],
    ['a started session', state({ started: true }), 'join', 'workspace'],
    ['no session', state(), 'modeSelect', 'allow'],
    ['no session', state(), 'join', 'allow'],
  ] as const)('%s on %s -> %s', (_who, given, screen, expected) => {
    expect(screenAccessFor(given, screen)).toBe(expected)
  })
})

describe('announcementFor', () => {
  const participant = {
    mode: 'live',
    role: 'participant',
    myName: 'Sam',
    participantId: 'p-1',
  } as const

  it('announces a participant under its own id and name', () => {
    expect(announcementFor(participant)).toEqual({ participantId: 'p-1', name: 'Sam' })
  })

  it('announces the facilitator under the reserved facilitator id', () => {
    expect(
      announcementFor({ ...participant, role: 'facilitator', participantId: '' }),
    ).toEqual({ participantId: 'facilitator', name: 'Sam' })
  })

  it('announces nothing outside a live session, without a name, or without an id', () => {
    expect(announcementFor({ ...participant, mode: 'manual' })).toBeNull()
    expect(announcementFor({ ...participant, myName: '   ' })).toBeNull()
    expect(announcementFor({ ...participant, participantId: '' })).toBeNull()
  })
})
