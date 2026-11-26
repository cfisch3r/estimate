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
import type { DiagnosticsLog } from '../ports/outbound/diagnosticsLog'
import type { DiagnosticEvent } from '../../domain/diagnosis/types'
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

const { joinSessionMock, fakeSession, emitState, emit, setFacilitator } = vi.hoisted(
  () => {
    let listener: ((state: ConnectionState) => void) | null = null
    let current: ConnectionState = { status: 'connecting', peerIds: [] }
    const handlers: Record<string, Set<(...args: never[]) => void>> = {}
    let requestSnapshotResponder: (() => unknown) | null = null
    let facilitatorPresent = false
    const capture = (name: string) => (cb: (...args: never[]) => void) => {
      handlers[name] ??= new Set()
      handlers[name].add(cb)
      return () => {
        handlers[name]?.delete(cb)
      }
    }
    // One fake serves both roles: it has every operation of the facilitator's
    // and the participant's session, and records which ones the controller used.
    const fakeSession = {
      getConnectionState: () => current,
      onConnectionStateChange: vi.fn((cb: (state: ConnectionState) => void) => {
        listener = cb
        return () => {
          listener = null
        }
      }),
      onAnnounce: vi.fn(capture('announce')),
      onPeerJoin: vi.fn(capture('peerJoin')),
      onPeerLeave: vi.fn(capture('peerLeave')),
      sendAnnounce: vi.fn(),
      leave: vi.fn(),
      // The facilitator's session.
      onEstimate: vi.fn(capture('estimate')),
      onSnapshotRequest: vi.fn((cb: () => unknown) => {
        requestSnapshotResponder = cb
        return () => {
          requestSnapshotResponder = null
        }
      }),
      sendSnapshot: vi.fn(),
      // The participant's session.
      hasFacilitator: () => facilitatorPresent,
      onFacilitatorChange: vi.fn(capture('facilitatorChange')),
      onFacilitatorSnapshot: vi.fn(capture('facilitatorSnapshot')),
      sendEstimate: vi.fn(() => Promise.resolve()),
      requestSnapshot: vi.fn(() => Promise.resolve(requestSnapshotResponder?.())),
    }
    const emitState = (state: ConnectionState) => {
      current = state
      listener?.(state)
    }
    const emit = (name: string, ...args: unknown[]) => {
      for (const handler of handlers[name] ?? []) handler(...(args as never[]))
    }
    /** What the participant's session does when it finds or loses the
     *  facilitator's peer. Without `notify`, only the state changes. */
    const setFacilitator = (present: boolean, notify = true) => {
      facilitatorPresent = present
      if (notify) emit('facilitatorChange', present)
    }
    const joinSessionMock = {
      asFacilitator: vi.fn(() => fakeSession),
      asParticipant: vi.fn(() => fakeSession),
    }
    return { joinSessionMock, fakeSession, emitState, emit, setFacilitator }
  },
)

/** Drains the promise chains the controller kicks off (snapshot pull, resend) by
 *  yielding one macrotask, which runs every queued microtask first. A fixed number of
 *  `await Promise.resolve()` ticks would let a negative assertion pass vacuously if a
 *  chain ever grew longer than the count. */
async function flushMicrotasks() {
  if (vi.isFakeTimers()) await vi.advanceTimersByTimeAsync(0)
  else await new Promise<void>((resolve) => setTimeout(resolve, 0))
}

let controller: LiveSessionController

/** What the controller recorded. */
let recorded: DiagnosticEvent[] = []
const diagnostics: DiagnosticsLog = {
  record: (event) => {
    recorded.push(event)
  },
  read: () => ({ available: true, entries: [], userAgent: '' }),
  clear: () => {},
}

beforeEach(() => {
  recorded = []
  controller = createLiveSessionController({
    joinSession: joinSessionMock as unknown as JoinSession,
    diagnostics,
  })
  joinSessionMock.asFacilitator.mockClear()
  joinSessionMock.asParticipant.mockClear()
  fakeSession.onEstimate.mockClear()
  fakeSession.onSnapshotRequest.mockClear()
  fakeSession.onFacilitatorSnapshot.mockClear()
  fakeSession.onFacilitatorChange.mockClear()
  setFacilitator(false, false)
  fakeSession.leave.mockClear()
  fakeSession.onConnectionStateChange.mockClear()
  fakeSession.sendEstimate.mockClear()
  fakeSession.sendSnapshot.mockClear()
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

  it('flips a participant to connected once its session finds the facilitator', async () => {
    setSessionState({
      mode: 'live',
      role: 'participant',
      participantId: 'p-self',
      myName: 'Sam Rivera',
    })
    controller.api.connect('K7F9Q2')

    emitState({ status: 'connected', peerIds: ['peer-fac'] })
    expect(useConnectionStore.getState().connectionStatus).toBe('connecting')

    setFacilitator(true)

    expect(useConnectionStore.getState().connectionStatus).toBe('connected')
  })

  it('drops a participant back to connecting (not disconnected) when the facilitator leaves, and pulls again when it returns', async () => {
    setSessionState({
      mode: 'live',
      role: 'participant',
      participantId: 'p-self',
      myName: 'Sam Rivera',
    })
    controller.api.connect('K7F9Q2')

    emitState({ status: 'connected', peerIds: ['peer-fac', 'peer-other'] })
    setFacilitator(true)
    await flushMicrotasks()
    expect(useConnectionStore.getState().connectionStatus).toBe('connected')

    // The link is still up (peer-other), but the facilitator is gone.
    emitState({ status: 'connected', peerIds: ['peer-other'] })
    setFacilitator(false)

    expect(useConnectionStore.getState().connectionStatus).toBe('connecting')
    expect(useConnectionStore.getState().peerCount).toBe(1)

    fakeSession.requestSnapshot.mockClear()
    fakeSession.requestSnapshot.mockResolvedValue({
      currentItem: null,
      unit: 'days',
      revealed: false,
      round: 0,
      roster: [],
      submissions: [],
      finalizedItemIds: [],
      finalResult: null,
    })
    setFacilitator(true)
    await flushMicrotasks()
    expect(fakeSession.requestSnapshot).toHaveBeenCalledTimes(1)
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

  it("takes the facilitator's snapshots into the store, including reveal and Retry via later snapshots", async () => {
    setSessionState({ mode: 'live', role: 'participant' })
    controller.api.connect('K7F9Q2')

    const item = { id: 'item-1', title: 'Retry queue', description: 'backoff' }
    emit('facilitatorSnapshot', {
      currentItem: item,
      unit: 'days',
      revealed: false,
      round: 0,
      roster: [{ participantId: 'p2', submitted: true, connected: true }],
      submissions: [],
      finalizedItemIds: [],
      finalResult: null,
    })
    expect(useRoundStore.getState().liveRound?.item.title).toBe('Retry queue')
    expect(useRoundStore.getState().liveRound?.roster).toHaveLength(1)

    // A later snapshot carries the reveal — there's no separate one-shot event
    // any more (ADR-003, "Versioned rounds").
    emit('facilitatorSnapshot', {
      currentItem: item,
      unit: 'days',
      revealed: true,
      round: 0,
      roster: [{ participantId: 'p2', submitted: true, connected: true }],
      submissions: [{ participantId: 'p2', best: 2, likely: 4, worst: 8 }],
      finalizedItemIds: [],
      finalResult: null,
    })
    expect(useRoundStore.getState().liveRound?.revealed).toBe(true)

    // And a Retry is just a round bump on the next snapshot.
    emit('facilitatorSnapshot', {
      currentItem: item,
      unit: 'days',
      revealed: false,
      round: 1,
      roster: [],
      submissions: [],
      finalizedItemIds: [],
      finalResult: null,
    })
    expect(useRoundStore.getState().liveRound?.revealed).toBe(false)
    expect(useRoundStore.getState().liveRound?.round).toBe(1)
  })

  it('joins as a participant and listens only for what a participant takes', () => {
    setSessionState({ mode: 'live', role: 'participant' })

    controller.api.connect('K7F9Q2')

    expect(joinSessionMock.asParticipant).toHaveBeenCalledWith('K7F9Q2')
    expect(joinSessionMock.asFacilitator).not.toHaveBeenCalled()
    expect(fakeSession.onFacilitatorSnapshot).toHaveBeenCalledTimes(1)
    expect(fakeSession.onEstimate).not.toHaveBeenCalled()
    expect(fakeSession.onSnapshotRequest).not.toHaveBeenCalled()
  })

  it('joins as the facilitator and takes no snapshot from anyone', () => {
    setSessionState({ mode: 'live', role: 'facilitator' })

    controller.api.connect('K7F9Q2')

    expect(joinSessionMock.asFacilitator).toHaveBeenCalledWith('K7F9Q2')
    expect(joinSessionMock.asParticipant).not.toHaveBeenCalled()
    expect(fakeSession.onEstimate).toHaveBeenCalledTimes(1)
    expect(fakeSession.onSnapshotRequest).toHaveBeenCalledTimes(1)
    expect(fakeSession.onFacilitatorSnapshot).not.toHaveBeenCalled()
    expect(fakeSession.onFacilitatorChange).not.toHaveBeenCalled()
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
    fakeSession.sendSnapshot.mockClear()

    emit('peerJoin', 'peer-new')

    expect(fakeSession.sendSnapshot).not.toHaveBeenCalled()
  })

  it('answers a snapshot request with the current facilitator snapshot', async () => {
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

    const respond = fakeSession.onSnapshotRequest.mock.calls[0]?.[0] as
      (() => { currentItem: { id: string } | null }) | undefined
    expect(respond).toBeDefined()
    expect(respond?.()).toMatchObject({
      currentItem: { id: 'i1', title: 'Retry queue', description: 'backoff' },
      unit: 'weeks',
      revealed: false,
    })
  })

  it("pulls the facilitator's snapshot once the participant session finds the facilitator", async () => {
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
      finalResult: null,
    }
    fakeSession.requestSnapshot.mockResolvedValue(snapshot)

    setFacilitator(true)
    await flushMicrotasks()

    expect(fakeSession.requestSnapshot).toHaveBeenCalledTimes(1)
    expect(useRoundStore.getState().liveRound?.item.title).toBe('Retry queue')
  })

  it('does not pull when the facilitator leaves', async () => {
    setSessionState({
      mode: 'live',
      role: 'participant',
      participantId: 'p-self',
      myName: 'Sam Rivera',
    })
    controller.api.connect('K7F9Q2')

    setFacilitator(false)
    await flushMicrotasks()

    expect(fakeSession.requestSnapshot).not.toHaveBeenCalled()
  })

  it('sends an estimate through the participant session, which targets the facilitator', async () => {
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
      finalResult: null,
    })

    setFacilitator(true)
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
    )
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
      finalResult: null,
    })
    setFacilitator(true)
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
      finalResult: null,
    })
    setFacilitator(true)
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
      finalResult: null,
    })
    setFacilitator(true)
    await flushMicrotasks()
    const mine = estimateOf('p-self')
    useRoundStore.getState().submitEstimate(mine)
    fakeSession.sendEstimate.mockClear()

    emit('facilitatorSnapshot', {
      currentItem: { id: 'i1', title: 'Item', description: '' },
      unit: 'days',
      revealed: false,
      round: 0,
      roster: [{ participantId: 'p-self', submitted: false, connected: true }],
      submissions: [],
      finalizedItemIds: [],
      finalResult: null,
    })
    await flushMicrotasks()

    // The locally stored, already-validated estimate goes out as-is.
    expect(fakeSession.sendEstimate).toHaveBeenCalledTimes(1)
    expect(fakeSession.sendEstimate).toHaveBeenCalledWith('i1', mine, 0)
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
      finalResult: null,
    })
    setFacilitator(true)
    await flushMicrotasks()
    useRoundStore.getState().submitEstimate(estimateOf('p1'))
    fakeSession.sendEstimate.mockClear()

    emit('facilitatorSnapshot', {
      currentItem: { id: 'i1', title: 'Item', description: '' },
      unit: 'days',
      revealed: false,
      round: 0,
      roster: [{ participantId: 'p-self', submitted: true, connected: true }],
      submissions: [],
      finalizedItemIds: [],
      finalResult: null,
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
      finalResult: null,
    })
    setFacilitator(true)
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
      finalResult: null,
    }
    emit('facilitatorSnapshot', unsubmittedSnapshot)
    await flushMicrotasks()
    emit('facilitatorSnapshot', unsubmittedSnapshot)
    await flushMicrotasks()

    expect(fakeSession.sendEstimate).toHaveBeenCalledTimes(1)
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
    fakeSession.sendSnapshot.mockClear()

    useRoundStore.getState().revealRound('i1')

    expect(fakeSession.sendSnapshot).toHaveBeenCalledWith(
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
    setSessionState({ mode: 'live', role: 'participant' })
    controller.api.connect('K7F9Q2')
    controller.api.disconnect()

    emit('facilitatorSnapshot', {
      currentItem: { id: 'x', title: 'late', description: '' },
      unit: 'days',
      revealed: false,
      submissions: [],
      finalizedItemIds: [],
      finalResult: null,
    })

    expect(useRoundStore.getState().liveRound).toBeNull()
  })
})

describe('the connection diagnosis', () => {
  const statuses = () =>
    recorded.flatMap((event) => (event.kind === 'status' ? [event.status] : []))

  it('records the session start with the code and role', () => {
    setSessionState({ mode: 'live', role: 'participant', sessionId: 'K7F9Q2' })

    controller.api.connect('K7F9Q2')

    expect(recorded).toEqual([
      { kind: 'session-start', sessionCode: 'K7F9Q2', role: 'participant' },
      { kind: 'status', status: 'connecting' },
    ])
  })

  it('records the status a participant sees, not the raw link', () => {
    setSessionState({ mode: 'live', role: 'participant', sessionId: 'K7F9Q2' })
    controller.api.connect('K7F9Q2')

    emitState({ status: 'connected', peerIds: ['peer-other'] })
    emitState({ status: 'connected', peerIds: ['peer-other', 'peer-f'] })
    setFacilitator(true)

    expect(statuses()).toEqual(['connecting', 'connected'])
  })

  it('records a status only when it changes', () => {
    setSessionState({ mode: 'live', role: 'facilitator', sessionId: 'K7F9Q2' })
    controller.api.connect('K7F9Q2')

    emitState({ status: 'connected', peerIds: ['p1'] })
    emitState({ status: 'connected', peerIds: ['p1', 'p2'] })
    emitState({ status: 'disconnected', peerIds: [] })

    expect(statuses()).toEqual(['connecting', 'connected', 'disconnected'])
  })

  it('records idle when the session is left', () => {
    setSessionState({ mode: 'live', role: 'facilitator', sessionId: 'K7F9Q2' })
    controller.api.connect('K7F9Q2')

    controller.api.disconnect()

    expect(statuses()).toEqual(['connecting', 'idle'])
  })

  it('records nothing when a session that never went live ends', () => {
    setSessionState({ mode: 'manual', role: 'facilitator' })

    controller.api.disconnect()

    expect(recorded).toEqual([])
  })
})
