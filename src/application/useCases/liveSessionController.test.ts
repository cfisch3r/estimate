import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createEstimate, type EstimationUnit } from '../../domain/estimate'
import { estimateOf } from '../../domain/testFixtures'
import type {
  Item,
  LiveConnectionStatus,
  LiveRound,
  SessionMode,
  SessionRole,
} from '../../domain/types'
import type { ConnectionState, JoinSession } from '../ports/outbound/networkTransport'
import { useConnectionStore } from '../stores/connection'
import { useRoundStore } from '../stores/round'
import { useSessionStore } from '../stores/session'
import {
  createLiveSessionController,
  type LiveSessionController,
} from './liveSessionController'

type SessionPatch = Partial<{
  sessionName: string
  unit: EstimationUnit
  items: Item[]
  activeItemId: string | null
}>
type ConnectionPatch = Partial<{
  mode: SessionMode
  role: SessionRole
  sessionId: string | null
  myName: string
  participantId: string
  connectionStatus: LiveConnectionStatus
  hasEverConnected: boolean
  peerCount: number
  participantNames: Record<string, string>
}>
type RoundPatch = Partial<{ liveRound: LiveRound | null }>

const SESSION_KEYS: (keyof SessionPatch)[] = [
  'sessionName',
  'unit',
  'items',
  'activeItemId',
]
const CONNECTION_KEYS: (keyof ConnectionPatch)[] = [
  'mode',
  'role',
  'sessionId',
  'myName',
  'participantId',
  'connectionStatus',
  'hasEverConnected',
  'peerCount',
  'participantNames',
]

/** Dispatches a combined patch (mirroring the pre-decomposition monolithic
 *  store's shape, which most of this file's fixtures still describe) to
 *  whichever of the three real stores now owns each field — see ADR-005. */
function setSessionState(patch: SessionPatch & ConnectionPatch & RoundPatch) {
  const session: SessionPatch = {}
  const connection: ConnectionPatch = {}
  const round: RoundPatch = {}
  for (const [key, value] of Object.entries(patch)) {
    if ((SESSION_KEYS as string[]).includes(key)) {
      ;(session as Record<string, unknown>)[key] = value
    } else if ((CONNECTION_KEYS as string[]).includes(key)) {
      ;(connection as Record<string, unknown>)[key] = value
    } else {
      ;(round as Record<string, unknown>)[key] = value
    }
  }
  if (Object.keys(session).length > 0) useSessionStore.setState(session)
  if (Object.keys(connection).length > 0) useConnectionStore.setState(connection)
  if (Object.keys(round).length > 0) useRoundStore.setState(round)
}

const { joinSessionMock, fakeSession, emitState, emit } = vi.hoisted(() => {
  let listener: ((state: ConnectionState) => void) | null = null
  let current: ConnectionState = { status: 'connecting', peerIds: [] }
  const handlers: Record<string, ((...args: never[]) => void) | null> = {
    estimate: null,
    syncState: null,
    announce: null,
    peerJoin: null,
    peerLeave: null,
  }
  let requestSnapshotResponder: (() => unknown) | null = null
  const capture = (name: string) => (cb: (...args: never[]) => void) => {
    handlers[name] = cb
    return () => {
      handlers[name] = null
    }
  }
  const fakeSession = {
    getConnectionState: () => current,
    onConnectionStateChange: vi.fn((cb: (state: ConnectionState) => void) => {
      listener = cb
      return () => {
        listener = null
      }
    }),
    onEstimate: vi.fn(capture('estimate')),
    onSyncState: vi.fn(capture('syncState')),
    onAnnounce: vi.fn(capture('announce')),
    onRequestSnapshot: vi.fn((cb: () => unknown) => {
      requestSnapshotResponder = cb
      return () => {
        requestSnapshotResponder = null
      }
    }),
    onPeerJoin: vi.fn(capture('peerJoin')),
    onPeerLeave: vi.fn(capture('peerLeave')),
    sendEstimate: vi.fn(() => Promise.resolve()),
    sendSyncState: vi.fn(),
    sendAnnounce: vi.fn(),
    requestSnapshot: vi.fn(() => Promise.resolve(requestSnapshotResponder?.())),
    leave: vi.fn(),
  }
  const emitState = (state: ConnectionState) => {
    current = state
    listener?.(state)
  }
  const emit = (name: string, ...args: unknown[]) =>
    handlers[name]?.(...(args as never[]))
  return { joinSessionMock: vi.fn(() => fakeSession), fakeSession, emitState, emit }
})

/** Drains the promise chains the controller kicks off (snapshot pull, resend). React's
 *  `act` used to do this for us; with no React in the way, do it explicitly. */
async function flushMicrotasks() {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

let controller: LiveSessionController

beforeEach(() => {
  controller = createLiveSessionController({
    joinSession: joinSessionMock as unknown as JoinSession,
  })
  joinSessionMock.mockClear()
  fakeSession.leave.mockClear()
  fakeSession.onConnectionStateChange.mockClear()
  fakeSession.sendEstimate.mockClear()
  fakeSession.sendSyncState.mockClear()
  fakeSession.sendAnnounce.mockClear()
  fakeSession.requestSnapshot.mockClear()
  fakeSession.sendEstimate.mockImplementation(() => Promise.resolve())
  emitState({ status: 'connecting', peerIds: [] })
  setSessionState({
    connectionStatus: 'idle',
    peerCount: 0,
    mode: 'manual',
    role: 'facilitator',
    sessionId: null,
    myName: '',
    participantId: '',
    items: [],
    activeItemId: null,
    liveRound: null,
    participantNames: {},
  })
})

afterEach(() => {
  controller.dispose()
  vi.useRealTimers()
})

describe('createLiveSessionController', () => {
  it('mirrors later connection-state changes into the store', async () => {
    controller.api.connect('K7F9Q2')

    emitState({ status: 'connected', peerIds: ['p1', 'p2'] })

    expect(useConnectionStore.getState().connectionStatus).toBe('connected')
    expect(useConnectionStore.getState().peerCount).toBe(2)
  })

  it('does not report a participant as connected until the facilitator announces', async () => {
    setSessionState({
      mode: 'live',
      role: 'participant',
      participantId: 'p-self',
      myName: 'Sam Rivera',
    })
    controller.api.connect('K7F9Q2')

    // Reaches a peer, but it isn't the facilitator yet.
    emitState({ status: 'connected', peerIds: ['peer-other'] })

    expect(useConnectionStore.getState().connectionStatus).toBe('connecting')
    expect(useConnectionStore.getState().peerCount).toBe(1)
  })

  it("flips a participant to connected once the facilitator's announce arrives", async () => {
    setSessionState({
      mode: 'live',
      role: 'participant',
      participantId: 'p-self',
      myName: 'Sam Rivera',
    })
    controller.api.connect('K7F9Q2')

    emitState({ status: 'connected', peerIds: ['peer-fac'] })
    expect(useConnectionStore.getState().connectionStatus).toBe('connecting')

    emit('announce', { participantId: 'facilitator', name: 'Facilitator' }, 'peer-fac')

    expect(useConnectionStore.getState().connectionStatus).toBe('connected')
  })

  it('drops a participant back to connecting (not disconnected) when only the facilitator peer leaves', async () => {
    setSessionState({
      mode: 'live',
      role: 'participant',
      participantId: 'p-self',
      myName: 'Sam Rivera',
    })
    controller.api.connect('K7F9Q2')

    emitState({ status: 'connected', peerIds: ['peer-fac', 'peer-other'] })
    emit('announce', { participantId: 'facilitator', name: 'Facilitator' }, 'peer-fac')
    emit('announce', { participantId: 'p-other', name: 'Other' }, 'peer-other')
    expect(useConnectionStore.getState().connectionStatus).toBe('connected')

    // Mirrors connection.ts's real ordering: the tracker's own state-change
    // fires before its peer-leave listeners, so the raw peer count drops
    // first (leaving connectionStatus stale at 'connected', since peer-other
    // is still up) and only the onPeerLeave handler's facilitator-departure
    // check corrects it back down.
    emitState({ status: 'connected', peerIds: ['peer-other'] })
    emit('peerLeave', 'peer-fac')

    expect(useConnectionStore.getState().connectionStatus).toBe('connecting')
    expect(useConnectionStore.getState().peerCount).toBe(1)

    // The facilitator reconnecting under a new peerId still triggers a pull
    // (lastPulledFacilitatorPeerId was cleared on the departure above).
    fakeSession.requestSnapshot.mockResolvedValue({
      currentItem: null,
      unit: 'days',
      revealed: false,
      round: 0,
      roster: [],
      submissions: [],
      finalizedItemIds: [],
    })
    emit('announce', { participantId: 'facilitator', name: 'Facilitator' }, 'peer-fac-2')
    await flushMicrotasks()
    expect(fakeSession.requestSnapshot).toHaveBeenCalledWith('peer-fac-2')
  })

  it('leaves the room on dispose without touching the stores', () => {
    controller.api.connect('K7F9Q2')
    useConnectionStore.setState({ connectionStatus: 'connected', peerCount: 2 })

    controller.dispose()

    expect(fakeSession.leave).toHaveBeenCalled()
    expect(useConnectionStore.getState().connectionStatus).toBe('connected')
    expect(useConnectionStore.getState().peerCount).toBe(2)
  })

  it('tears down the room and resets the store on disconnect', async () => {
    controller.api.connect('K7F9Q2')

    controller.api.disconnect()

    expect(fakeSession.leave).toHaveBeenCalled()
    expect(useConnectionStore.getState().connectionStatus).toBe('idle')
    expect(useConnectionStore.getState().peerCount).toBe(0)
  })

  it('dispatches incoming syncState into the store, including reveal and Retry via later snapshots', async () => {
    setSessionState({ mode: 'live', role: 'participant' })
    controller.api.connect('K7F9Q2')

    const item = { id: 'item-1', title: 'Retry queue', description: 'backoff' }
    emit('syncState', {
      currentItem: item,
      unit: 'days',
      revealed: false,
      round: 0,
      roster: [{ participantId: 'p2', submitted: true, connected: true }],
      submissions: [],
      finalizedItemIds: [],
    })
    expect(useRoundStore.getState().liveRound?.item.title).toBe('Retry queue')
    expect(useRoundStore.getState().liveRound?.roster).toHaveLength(1)

    // A later snapshot carries the reveal — there's no separate one-shot event
    // any more (ADR-003, "Versioned rounds").
    emit('syncState', {
      currentItem: item,
      unit: 'days',
      revealed: true,
      round: 0,
      roster: [{ participantId: 'p2', submitted: true, connected: true }],
      submissions: [{ participantId: 'p2', best: 2, likely: 4, worst: 8 }],
      finalizedItemIds: [],
    })
    expect(useRoundStore.getState().liveRound?.revealed).toBe(true)

    // And a Retry is just a round bump on the next snapshot.
    emit('syncState', {
      currentItem: item,
      unit: 'days',
      revealed: false,
      round: 1,
      roster: [],
      submissions: [],
      finalizedItemIds: [],
    })
    expect(useRoundStore.getState().liveRound?.revealed).toBe(false)
    expect(useRoundStore.getState().liveRound?.round).toBe(1)
  })

  it('does not record another peer’s estimate on a participant client (sendEstimate targets the facilitator only)', async () => {
    setSessionState({
      mode: 'live',
      role: 'participant',
      items: [],
      activeItemId: null,
    })
    controller.api.connect('K7F9Q2')

    emit('estimate', 'item-1', { participantId: 'p2', best: 2, likely: 4, worst: 8 })

    expect(useRoundStore.getState().liveRound).toBeNull()
  })

  it('does not re-broadcast the snapshot on peer-join (a newcomer pulls it instead)', async () => {
    controller.api.connect('K7F9Q2')

    setSessionState({
      mode: 'live',
      role: 'facilitator',
      sessionId: 'K7F9Q2',
      items: [
        {
          id: 'i1',
          title: 'Retry queue',
          description: 'backoff',
          notes: '',
          finalResult: null,
          submissions: [],
          revealed: false,
          round: 0,
        },
      ],
      activeItemId: 'i1',
      unit: 'weeks',
    })
    fakeSession.sendSyncState.mockClear()

    emit('peerJoin', 'peer-new')

    expect(fakeSession.sendSyncState).not.toHaveBeenCalled()
  })

  it('answers a requestSnapshot pull with the current facilitator snapshot', async () => {
    controller.api.connect('K7F9Q2')

    setSessionState({
      mode: 'live',
      role: 'facilitator',
      sessionId: 'K7F9Q2',
      items: [
        {
          id: 'i1',
          title: 'Retry queue',
          description: 'backoff',
          notes: '',
          finalResult: null,
          submissions: [],
          revealed: false,
          round: 0,
        },
      ],
      activeItemId: 'i1',
      unit: 'weeks',
    })

    const respond = fakeSession.onRequestSnapshot.mock.calls[0]?.[0] as
      (() => { currentItem: { id: string } | null }) | undefined
    expect(respond).toBeDefined()
    expect(respond?.()).toMatchObject({
      currentItem: { id: 'i1', title: 'Retry queue', description: 'backoff' },
      unit: 'weeks',
      revealed: false,
    })
  })

  it("pulls the facilitator's snapshot once a participant learns its peerId from an announce", async () => {
    setSessionState({
      mode: 'live',
      role: 'participant',
      participantId: 'p-self',
      myName: 'Sam Rivera',
    })
    controller.api.connect('K7F9Q2')

    const snapshot = {
      currentItem: { id: 'i1', title: 'Retry queue', description: 'backoff' },
      unit: 'days' as const,
      revealed: false,
      round: 0,
      roster: [{ participantId: 'p-self', submitted: false, connected: true }],
      submissions: [],
      finalizedItemIds: [],
    }
    fakeSession.requestSnapshot.mockResolvedValue(snapshot)

    emit('announce', { participantId: 'facilitator', name: 'Facilitator' }, 'peer-fac')
    await flushMicrotasks()

    expect(fakeSession.requestSnapshot).toHaveBeenCalledWith('peer-fac')
    expect(useRoundStore.getState().liveRound?.item.title).toBe('Retry queue')
  })

  it("does not re-pull when the facilitator's peerId is re-announced unchanged", async () => {
    setSessionState({
      mode: 'live',
      role: 'participant',
      participantId: 'p-self',
      myName: 'Sam Rivera',
    })
    controller.api.connect('K7F9Q2')

    fakeSession.requestSnapshot.mockResolvedValue({
      currentItem: null,
      unit: 'days' as const,
      revealed: false,
      round: 0,
      roster: [],
      submissions: [],
      finalizedItemIds: [],
    })

    emit('announce', { participantId: 'facilitator', name: 'Facilitator' }, 'peer-fac')
    await flushMicrotasks()
    fakeSession.requestSnapshot.mockClear()

    // A different peer joining re-triggers every client's announce, including
    // the facilitator's own — re-announcing the same peerId must not re-pull.
    emit('announce', { participantId: 'facilitator', name: 'Facilitator' }, 'peer-fac')

    expect(fakeSession.requestSnapshot).not.toHaveBeenCalled()
  })

  it("targets sendEstimate at the facilitator's peerId once learned", async () => {
    setSessionState({
      mode: 'live',
      role: 'participant',
      participantId: 'p-self',
      myName: 'Sam Rivera',
    })
    controller.api.connect('K7F9Q2')
    fakeSession.requestSnapshot.mockResolvedValue({
      currentItem: null,
      unit: 'days' as const,
      revealed: false,
      round: 0,
      roster: [],
      submissions: [],
      finalizedItemIds: [],
    })

    emit('announce', { participantId: 'facilitator', name: 'Facilitator' }, 'peer-fac')
    await flushMicrotasks()

    const estimate = createEstimate({
      participantId: 'p-self',
      best: 1,
      likely: 2,
      worst: 3,
    })
    if (!estimate.ok) throw new Error('test fixture invalid')
    await controller.api.sendEstimate('i1', estimate.value, 0).catch(() => {})

    expect(fakeSession.sendEstimate).toHaveBeenCalledWith(
      'i1',
      expect.objectContaining({ participantId: 'p-self' }),
      0,
      'peer-fac',
    )
  })

  it("never falls back to an untargeted broadcast when the facilitator's peerId isn't known yet", async () => {
    setSessionState({
      mode: 'live',
      role: 'participant',
      participantId: 'p-self',
      myName: 'Sam Rivera',
    })
    controller.api.connect('K7F9Q2')

    // No announce from the facilitator has arrived yet, so its peerId is unknown.
    const estimate = createEstimate({
      participantId: 'p-self',
      best: 1,
      likely: 2,
      worst: 3,
    })
    if (!estimate.ok) throw new Error('test fixture invalid')
    await controller.api.sendEstimate('i1', estimate.value, 0).catch(() => {})

    expect(fakeSession.sendEstimate).not.toHaveBeenCalled()
  })

  it('retries a sendEstimate that times out, and delivers on the retry', async () => {
    vi.useFakeTimers()
    setSessionState({
      mode: 'live',
      role: 'participant',
      participantId: 'p-self',
      myName: 'Sam Rivera',
    })
    controller.api.connect('K7F9Q2')
    fakeSession.requestSnapshot.mockResolvedValue({
      currentItem: null,
      unit: 'days' as const,
      revealed: false,
      round: 0,
      roster: [],
      submissions: [],
      finalizedItemIds: [],
    })
    emit('announce', { participantId: 'facilitator', name: 'Facilitator' }, 'peer-fac')
    await flushMicrotasks()

    const timeoutError = Object.assign(new Error('timed out'), { kind: 'timeout' })
    fakeSession.sendEstimate.mockRejectedValueOnce(timeoutError).mockResolvedValueOnce()

    const estimate = createEstimate({
      participantId: 'p-self',
      best: 1,
      likely: 2,
      worst: 3,
    })
    if (!estimate.ok) throw new Error('test fixture invalid')

    let resolved = false
    const sendPromise = controller.api.sendEstimate('i1', estimate.value, 0).then(() => {
      resolved = true
    })

    await vi.advanceTimersByTimeAsync(500)
    await sendPromise

    expect(resolved).toBe(true)
    expect(fakeSession.sendEstimate).toHaveBeenCalledTimes(2)
  })

  it('does not retry a sendEstimate that fails as disconnected', async () => {
    setSessionState({
      mode: 'live',
      role: 'participant',
      participantId: 'p-self',
      myName: 'Sam Rivera',
    })
    controller.api.connect('K7F9Q2')
    fakeSession.requestSnapshot.mockResolvedValue({
      currentItem: null,
      unit: 'days' as const,
      revealed: false,
      round: 0,
      roster: [],
      submissions: [],
      finalizedItemIds: [],
    })
    emit('announce', { participantId: 'facilitator', name: 'Facilitator' }, 'peer-fac')
    await flushMicrotasks()

    const disconnectedError = Object.assign(new Error('link is dead'), {
      kind: 'disconnected',
    })
    fakeSession.sendEstimate.mockRejectedValueOnce(disconnectedError)

    const estimate = createEstimate({
      participantId: 'p-self',
      best: 1,
      likely: 2,
      worst: 3,
    })
    if (!estimate.ok) throw new Error('test fixture invalid')

    await expect(controller.api.sendEstimate('i1', estimate.value, 0)).rejects.toBe(
      disconnectedError,
    )
    expect(fakeSession.sendEstimate).toHaveBeenCalledTimes(1)
  })

  it('resends this participant’s estimate when a snapshot shows it not yet in the roster', async () => {
    setSessionState({
      mode: 'live',
      role: 'participant',
      participantId: 'p-self',
      myName: 'Sam Rivera',
    })
    controller.api.connect('K7F9Q2')
    fakeSession.requestSnapshot.mockResolvedValue({
      currentItem: { id: 'i1', title: 'Item', description: '' },
      unit: 'days' as const,
      revealed: false,
      round: 0,
      roster: [],
      submissions: [],
      finalizedItemIds: [],
    })
    emit('announce', { participantId: 'facilitator', name: 'Facilitator' }, 'peer-fac')
    await flushMicrotasks()
    const mine = estimateOf('p-self')
    useRoundStore.getState().submitEstimate(mine)
    fakeSession.sendEstimate.mockClear()

    emit('syncState', {
      currentItem: { id: 'i1', title: 'Item', description: '' },
      unit: 'days',
      revealed: false,
      round: 0,
      roster: [{ participantId: 'p-self', submitted: false, connected: true }],
      submissions: [],
      finalizedItemIds: [],
    })
    await flushMicrotasks()

    // The locally stored, already-validated estimate goes out as-is.
    expect(fakeSession.sendEstimate).toHaveBeenCalledTimes(1)
    expect(fakeSession.sendEstimate).toHaveBeenCalledWith('i1', mine, 0, 'peer-fac')
  })

  it('does not resend when the roster already shows this participant as submitted', async () => {
    setSessionState({
      mode: 'live',
      role: 'participant',
      participantId: 'p-self',
      myName: 'Sam Rivera',
    })
    controller.api.connect('K7F9Q2')
    fakeSession.requestSnapshot.mockResolvedValue({
      currentItem: { id: 'i1', title: 'Item', description: '' },
      unit: 'days' as const,
      revealed: false,
      round: 0,
      roster: [],
      submissions: [],
      finalizedItemIds: [],
    })
    emit('announce', { participantId: 'facilitator', name: 'Facilitator' }, 'peer-fac')
    await flushMicrotasks()
    useRoundStore.getState().submitEstimate(estimateOf('p1'))
    fakeSession.sendEstimate.mockClear()

    emit('syncState', {
      currentItem: { id: 'i1', title: 'Item', description: '' },
      unit: 'days',
      revealed: false,
      round: 0,
      roster: [{ participantId: 'p-self', submitted: true, connected: true }],
      submissions: [],
      finalizedItemIds: [],
    })
    await flushMicrotasks()

    expect(fakeSession.sendEstimate).not.toHaveBeenCalled()
  })

  it('does not stack a second roster-triggered resend while one is already in flight', async () => {
    setSessionState({
      mode: 'live',
      role: 'participant',
      participantId: 'p-self',
      myName: 'Sam Rivera',
    })
    controller.api.connect('K7F9Q2')
    fakeSession.requestSnapshot.mockResolvedValue({
      currentItem: { id: 'i1', title: 'Item', description: '' },
      unit: 'days' as const,
      revealed: false,
      round: 0,
      roster: [],
      submissions: [],
      finalizedItemIds: [],
    })
    emit('announce', { participantId: 'facilitator', name: 'Facilitator' }, 'peer-fac')
    await flushMicrotasks()
    useRoundStore.getState().submitEstimate(estimateOf('p1'))
    fakeSession.sendEstimate.mockClear()
    // First resend never settles within this test, so a second snapshot
    // arriving before it does must not fire a duplicate.
    fakeSession.sendEstimate.mockImplementation(() => new Promise(() => {}))

    const unsubmittedSnapshot = {
      currentItem: { id: 'i1', title: 'Item', description: '' },
      unit: 'days' as const,
      revealed: false,
      round: 0,
      roster: [{ participantId: 'p-self', submitted: false, connected: true }],
      submissions: [],
      finalizedItemIds: [],
    }
    emit('syncState', unsubmittedSnapshot)
    await flushMicrotasks()
    emit('syncState', unsubmittedSnapshot)
    await flushMicrotasks()

    expect(fakeSession.sendEstimate).toHaveBeenCalledTimes(1)
  })

  it('resends against the facilitator’s current peerId if it changes mid-retry', async () => {
    vi.useFakeTimers()
    setSessionState({
      mode: 'live',
      role: 'participant',
      participantId: 'p-self',
      myName: 'Sam Rivera',
    })
    controller.api.connect('K7F9Q2')
    fakeSession.requestSnapshot.mockResolvedValue({
      currentItem: null,
      unit: 'days' as const,
      revealed: false,
      round: 0,
      roster: [],
      submissions: [],
      finalizedItemIds: [],
    })
    emit(
      'announce',
      { participantId: 'facilitator', name: 'Facilitator' },
      'peer-fac-old',
    )
    await flushMicrotasks()

    const timeoutError = Object.assign(new Error('timed out'), { kind: 'timeout' })
    fakeSession.sendEstimate.mockRejectedValueOnce(timeoutError).mockResolvedValueOnce()

    const estimate = createEstimate({
      participantId: 'p-self',
      best: 1,
      likely: 2,
      worst: 3,
    })
    if (!estimate.ok) throw new Error('test fixture invalid')

    const sendPromise = controller.api.sendEstimate('i1', estimate.value, 0)

    // The facilitator reconnects mid-retry, announcing under a new peerId.
    emit(
      'announce',
      { participantId: 'facilitator', name: 'Facilitator' },
      'peer-fac-new',
    )
    await flushMicrotasks()
    await vi.advanceTimersByTimeAsync(500)
    await sendPromise

    expect(fakeSession.sendEstimate).toHaveBeenNthCalledWith(
      1,
      'i1',
      expect.objectContaining({ participantId: 'p-self' }),
      0,
      'peer-fac-old',
    )
    expect(fakeSession.sendEstimate).toHaveBeenNthCalledWith(
      2,
      'i1',
      expect.objectContaining({ participantId: 'p-self' }),
      0,
      'peer-fac-new',
    )
  })

  it('broadcasts revealed:true plus the frozen submissions once the facilitator reveals', async () => {
    controller.api.connect('K7F9Q2')

    const sub = createEstimate({ participantId: 'p1', best: 2, likely: 4, worst: 8 })
    if (!sub.ok) throw new Error('bad fixture')

    setSessionState({
      mode: 'live',
      role: 'facilitator',
      sessionId: 'K7F9Q2',
      items: [
        {
          id: 'i1',
          title: 'Retry queue',
          description: 'backoff',
          notes: '',
          finalResult: null,
          submissions: [sub.value],
          revealed: false,
          round: 0,
        },
      ],
      activeItemId: 'i1',
    })
    fakeSession.sendSyncState.mockClear()

    useRoundStore.getState().revealRound('i1')

    expect(fakeSession.sendSyncState).toHaveBeenCalledWith(
      expect.objectContaining({ revealed: true, submissions: [sub.value] }),
    )
  })

  it('announces the local participant on connect and applies inbound announces', async () => {
    setSessionState({
      mode: 'live',
      role: 'participant',
      participantId: 'p-self',
      myName: 'Sam Rivera',
    })

    controller.api.connect('K7F9Q2')

    expect(fakeSession.sendAnnounce).toHaveBeenCalledWith({
      participantId: 'p-self',
      name: 'Sam Rivera',
    })

    emit('announce', { participantId: 'p-2', name: 'Jordan' })
    expect(useConnectionStore.getState().participantNames['p-2']).toBe('Jordan')
  })

  it('prunes a participant from the roster once their peer connection leaves', async () => {
    setSessionState({
      mode: 'live',
      role: 'facilitator',
      myName: 'Facilitator',
    })
    controller.api.connect('K7F9Q2')

    emit('announce', { participantId: 'p-2', name: 'Jordan' }, 'peer-2')
    expect(useConnectionStore.getState().participantNames['p-2']).toBe('Jordan')

    emit('peerLeave', 'peer-2')

    expect(useConnectionStore.getState().participantNames['p-2']).toBeUndefined()
  })

  it('does not prune on a participant client (roster pruning is facilitator-only)', async () => {
    setSessionState({
      mode: 'live',
      role: 'participant',
      participantId: 'p-self',
      myName: 'Sam Rivera',
    })
    controller.api.connect('K7F9Q2')

    emit('announce', { participantId: 'p-2', name: 'Jordan' }, 'peer-2')
    emit('peerLeave', 'peer-2')

    expect(useConnectionStore.getState().participantNames['p-2']).toBe('Jordan')
  })

  it('keeps a name backed by another live connection (two tabs, one participantId)', async () => {
    setSessionState({
      mode: 'live',
      role: 'facilitator',
      myName: 'Facilitator',
    })
    controller.api.connect('K7F9Q2')

    // Two tabs in the same browser share a participantId (see the JoinSession
    // warning) — each gets its own peerId.
    emit('announce', { participantId: 'p-2', name: 'Jordan' }, 'peer-2a')
    emit('announce', { participantId: 'p-2', name: 'Jordan' }, 'peer-2b')

    emit('peerLeave', 'peer-2a')

    expect(useConnectionStore.getState().participantNames['p-2']).toBe('Jordan')
  })

  it('keeps the name of a participant who already submitted this round', async () => {
    const sub = createEstimate({ participantId: 'p-2', best: 2, likely: 4, worst: 8 })
    if (!sub.ok) throw new Error('bad fixture')
    setSessionState({
      mode: 'live',
      role: 'facilitator',
      myName: 'Facilitator',
      items: [
        {
          id: 'i1',
          title: 'Retry queue',
          description: 'backoff',
          notes: '',
          finalResult: null,
          submissions: [sub.value],
          revealed: false,
          round: 0,
        },
      ],
      activeItemId: 'i1',
    })
    controller.api.connect('K7F9Q2')

    emit('announce', { participantId: 'p-2', name: 'Jordan' }, 'peer-2')
    emit('peerLeave', 'peer-2')

    expect(useConnectionStore.getState().participantNames['p-2']).toBe('Jordan')
  })

  it('does nothing when an unannounced peer leaves', async () => {
    setSessionState({
      mode: 'live',
      role: 'facilitator',
      myName: 'Facilitator',
      participantNames: { p2: 'Jordan' },
    })
    controller.api.connect('K7F9Q2')

    emit('peerLeave', 'peer-never-announced')

    expect(useConnectionStore.getState().participantNames).toEqual({ p2: 'Jordan' })
  })

  it('re-announces the local client when a peer joins', async () => {
    setSessionState({
      mode: 'live',
      role: 'facilitator',
      myName: 'Facilitator',
    })
    controller.api.connect('K7F9Q2')
    fakeSession.sendAnnounce.mockClear()

    emit('peerJoin', 'peer-new')

    expect(fakeSession.sendAnnounce).toHaveBeenCalledWith({
      participantId: 'facilitator',
      name: 'Facilitator',
    })
  })

  it('stops dispatching store updates after disconnect', async () => {
    controller.api.connect('K7F9Q2')
    controller.api.disconnect()

    emit('syncState', {
      currentItem: { id: 'x', title: 'late', description: '' },
      unit: 'days',
      revealed: false,
      submissions: [],
      finalizedItemIds: [],
    })

    expect(useRoundStore.getState().liveRound).toBeNull()
  })
})
