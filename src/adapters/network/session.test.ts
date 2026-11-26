import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createJoinSession, joinAsFacilitator, joinAsParticipant } from './session'
import type { DiagnosticsLog } from '../../application/ports/outbound/diagnosticsLog'
import type { DiagnosticEvent } from '../../domain/diagnosis/types'
import { createEstimate } from '../../domain/estimate'

const { joinRoomMock, fakeRoom } = vi.hoisted(() => {
  const actionsByName: Record<
    string,
    { send: ReturnType<typeof vi.fn>; onMessage: unknown }
  > = {}
  const requestActionsByName: Record<
    string,
    { request: ReturnType<typeof vi.fn>; onRequest: unknown }
  > = {}
  const fakeRoom = {
    makeAction: vi.fn((name: string, config?: { kind: 'request' }) => {
      if (config?.kind === 'request') {
        requestActionsByName[name] = { request: vi.fn(), onRequest: null }
        return requestActionsByName[name]
      }
      actionsByName[name] = { send: vi.fn(), onMessage: null }
      return actionsByName[name]
    }),
    onPeerJoin: null as ((peerId: string) => void) | null,
    onPeerLeave: null as ((peerId: string) => void) | null,
    leave: vi.fn(),
    actionsByName,
    requestActionsByName,
  }
  const joinRoomMock = vi.fn(
    (
      _config: {
        appId: string
        password?: string
        rtcPolyfill?: typeof RTCPeerConnection
      },
      _roomId: string,
      _callbacks: {
        onJoinError: (details: {
          error: string
          appId: string
          roomId: string
          peerId: string
        }) => void
      },
    ) => fakeRoom,
  )
  return { joinRoomMock, fakeRoom }
})

vi.mock('trystero/nostr', () => ({ joinRoom: joinRoomMock }))

beforeEach(() => {
  joinRoomMock.mockClear()
  fakeRoom.leave.mockClear()
  fakeRoom.onPeerJoin = null
  fakeRoom.onPeerLeave = null
})

const snapshot = {
  currentItem: null,
  sessionName: '',
  unit: 'days' as const,
  revealed: false,
  round: 0,
  roster: [],
  submissions: [],
  finalizedItemIds: [],
  finalResult: null,
}

/** Delivers an inbound message on the fake room's `name` action from `peerId`. */
function deliver(name: string, data: unknown, peerId: string) {
  const onMessage = fakeRoom.actionsByName[name]!.onMessage as (
    data: unknown,
    context: { peerId: string },
  ) => void
  onMessage(data, { peerId })
}

/** Answers an inbound request on the fake room's `name` action from `peerId`. */
function answer(name: string, data: unknown, peerId: string) {
  const onRequest = fakeRoom.requestActionsByName[name]!.onRequest as (
    data: unknown,
    context: { peerId: string },
  ) => unknown
  return () => onRequest(data, { peerId })
}

const facilitatorAnnounce = { participantId: 'facilitator', name: 'Facilitator' }

describe('a live session, either role', () => {
  it('joins the trystero room using the session id as the room id', () => {
    joinAsParticipant('session-abc')

    expect(joinRoomMock).toHaveBeenCalledWith(
      expect.objectContaining({ appId: expect.any(String) }),
      'session-abc',
      expect.anything(),
    )
  })

  it('passes an optional password through to the room config', () => {
    joinAsFacilitator('session-abc', { password: 'shh' })

    expect(joinRoomMock).toHaveBeenCalledWith(
      expect.objectContaining({ password: 'shh' }),
      'session-abc',
      expect.anything(),
    )
  })

  it('reflects a peer join in getConnectionState', () => {
    const session = joinAsParticipant('session-abc')

    fakeRoom.onPeerJoin?.('peer-1')

    expect(session.getConnectionState()).toEqual({
      status: 'connected',
      peerIds: ['peer-1'],
    })
  })

  it('notifies onPeerLeave subscribers when a peer leaves', () => {
    const session = joinAsFacilitator('session-abc')
    fakeRoom.onPeerJoin?.('peer-1')
    const cb = vi.fn()
    session.onPeerLeave(cb)

    fakeRoom.onPeerLeave?.('peer-1')

    expect(cb).toHaveBeenCalledWith('peer-1')
  })

  it('marks the connection disconnected on a join error', () => {
    const session = joinAsParticipant('session-abc')
    const onJoinError = joinRoomMock.mock.calls[0]?.[2].onJoinError
    if (!onJoinError) throw new Error('expected onJoinError callback')

    onJoinError({
      error: 'incorrect password',
      appId: 'estimate-app-v1',
      roomId: 'session-abc',
      peerId: 'peer-1',
    })

    expect(session.getConnectionState().status).toBe('disconnected')
  })

  it('leave() tears down the underlying room', () => {
    const session = joinAsFacilitator('session-abc')

    session.leave()

    expect(fakeRoom.leave).toHaveBeenCalled()
  })

  it('sendAnnounce delegates to the underlying announce action', () => {
    const session = joinAsParticipant('session-abc')

    session.sendAnnounce({ participantId: 'p-1', name: 'Sam Rivera' })

    expect(fakeRoom.actionsByName.announce!.send).toHaveBeenCalledWith({
      participantId: 'p-1',
      name: 'Sam Rivera',
    })
  })

  it('onAnnounce subscribers receive validated inbound announce messages', () => {
    const session = joinAsFacilitator('session-abc')
    const cb = vi.fn()
    session.onAnnounce(cb)

    deliver('announce', { participantId: 'p-2', name: '  Jordan  ' }, 'peer-2')

    expect(cb).toHaveBeenCalledWith({ participantId: 'p-2', name: 'Jordan' }, 'peer-2')
  })
})

describe('the facilitator session', () => {
  it('sends a snapshot through the syncState action', () => {
    const session = joinAsFacilitator('session-abc')

    session.sendSnapshot(snapshot)

    expect(fakeRoom.actionsByName.syncState!.send).toHaveBeenCalledWith(snapshot)
  })

  it('answers a snapshot request through its registered responder', () => {
    const session = joinAsFacilitator('session-abc')
    session.onSnapshotRequest(() => snapshot)

    expect(answer('requestSnapshot', null, 'peer-2')()).toBe(snapshot)
  })

  it('takes an estimate and acks it', () => {
    const session = joinAsFacilitator('session-abc')
    const cb = vi.fn()
    session.onEstimate(cb)
    const estimate = { participantId: 'p-2', best: 1, likely: 2, worst: 3 }

    const ack = answer(
      'submitEstimate',
      { itemId: 'item-1', round: 0, estimate },
      'peer-2',
    )()

    expect(ack).toEqual({ ok: true })
    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb).toHaveBeenCalledWith('item-1', estimate, 'peer-2', 0)
  })
})

describe('the participant session', () => {
  it('has no facilitator until the facilitator announces itself', () => {
    const session = joinAsParticipant('session-abc')
    fakeRoom.onPeerJoin?.('peer-f')

    expect(session.hasFacilitator()).toBe(false)
    deliver('announce', facilitatorAnnounce, 'peer-f')
    expect(session.hasFacilitator()).toBe(true)
  })

  it("doesn't take another participant's announce for the facilitator's", () => {
    const session = joinAsParticipant('session-abc')
    const cb = vi.fn()
    session.onFacilitatorSnapshot(cb)
    deliver('announce', facilitatorAnnounce, 'peer-f')

    deliver('announce', { participantId: 'p-x', name: 'Alex' }, 'peer-x')
    deliver('syncState', snapshot, 'peer-x')
    deliver('syncState', { ...snapshot, round: 1 }, 'peer-f')

    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb).toHaveBeenCalledWith({ ...snapshot, round: 1 })
  })

  it("takes a snapshot from the facilitator's peer", () => {
    const session = joinAsParticipant('session-abc')
    const cb = vi.fn()
    session.onFacilitatorSnapshot(cb)
    deliver('announce', facilitatorAnnounce, 'peer-f')

    deliver('syncState', snapshot, 'peer-f')

    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb).toHaveBeenCalledWith(snapshot)
  })

  it('drops a snapshot from another peer', () => {
    const session = joinAsParticipant('session-abc')
    const cb = vi.fn()
    session.onFacilitatorSnapshot(cb)
    deliver('announce', facilitatorAnnounce, 'peer-f')

    deliver('syncState', snapshot, 'peer-x')

    expect(cb).not.toHaveBeenCalled()
  })

  it('drops a snapshot that arrives before the facilitator announced itself', () => {
    const session = joinAsParticipant('session-abc')
    const cb = vi.fn()
    session.onFacilitatorSnapshot(cb)

    deliver('syncState', snapshot, 'peer-f')

    expect(cb).not.toHaveBeenCalled()
  })

  it("forgets the facilitator when its peer leaves, and drops that peer's snapshots", () => {
    const session = joinAsParticipant('session-abc')
    const snapshots = vi.fn()
    const changes = vi.fn()
    session.onFacilitatorSnapshot(snapshots)
    fakeRoom.onPeerJoin?.('peer-f')
    deliver('announce', facilitatorAnnounce, 'peer-f')
    session.onFacilitatorChange(changes)

    fakeRoom.onPeerLeave?.('peer-f')
    deliver('syncState', snapshot, 'peer-f')

    expect(session.hasFacilitator()).toBe(false)
    expect(changes).toHaveBeenCalledTimes(1)
    expect(changes).toHaveBeenCalledWith(false)
    expect(snapshots).not.toHaveBeenCalled()
  })

  it('keeps the facilitator when another peer leaves', () => {
    const session = joinAsParticipant('session-abc')
    fakeRoom.onPeerJoin?.('peer-f')
    fakeRoom.onPeerJoin?.('peer-x')
    deliver('announce', facilitatorAnnounce, 'peer-f')

    fakeRoom.onPeerLeave?.('peer-x')

    expect(session.hasFacilitator()).toBe(true)
  })

  it('follows a facilitator that announces itself again under a new peer', () => {
    const session = joinAsParticipant('session-abc')
    const snapshots = vi.fn()
    const changes = vi.fn()
    session.onFacilitatorSnapshot(snapshots)
    session.onFacilitatorChange(changes)
    deliver('announce', facilitatorAnnounce, 'peer-f')

    deliver('announce', facilitatorAnnounce, 'peer-f2')
    deliver('syncState', snapshot, 'peer-f')
    deliver('syncState', { ...snapshot, round: 1 }, 'peer-f2')

    expect(changes.mock.calls).toEqual([[true], [true]])
    expect(snapshots).toHaveBeenCalledTimes(1)
    expect(snapshots).toHaveBeenCalledWith({ ...snapshot, round: 1 })
  })

  it('reports no change when the facilitator announces itself again unchanged', () => {
    const session = joinAsParticipant('session-abc')
    const changes = vi.fn()
    deliver('announce', facilitatorAnnounce, 'peer-f')
    session.onFacilitatorChange(changes)

    deliver('announce', facilitatorAnnounce, 'peer-f')

    expect(changes).not.toHaveBeenCalled()
  })

  it("sends an estimate to the facilitator's peer", async () => {
    const session = joinAsParticipant('session-abc')
    const estimate = createEstimate({ participantId: 'a', best: 1, likely: 2, worst: 3 })
    if (!estimate.ok) throw new Error('test fixture invalid')
    fakeRoom.requestActionsByName.submitEstimate!.request.mockResolvedValue({ ok: true })
    deliver('announce', facilitatorAnnounce, 'peer-f')

    await session.sendEstimate('item-1', estimate.value, 2)

    expect(fakeRoom.requestActionsByName.submitEstimate!.request).toHaveBeenCalledWith(
      { itemId: 'item-1', estimate: estimate.value, round: 2 },
      { target: 'peer-f', timeoutMs: 800 },
    )
  })

  it("requests a snapshot from the facilitator's peer", async () => {
    const session = joinAsParticipant('session-abc')
    fakeRoom.requestActionsByName.requestSnapshot!.request.mockResolvedValue(snapshot)
    deliver('announce', facilitatorAnnounce, 'peer-f')

    const result = await session.requestSnapshot()

    expect(fakeRoom.requestActionsByName.requestSnapshot!.request).toHaveBeenCalledWith(
      null,
      { target: 'peer-f', timeoutMs: 800 },
    )
    expect(result).toEqual(snapshot)
  })

  it('rejects an estimate and a snapshot request as disconnected while no facilitator is known', async () => {
    const session = joinAsParticipant('session-abc')
    const estimate = createEstimate({ participantId: 'a', best: 1, likely: 2, worst: 3 })
    if (!estimate.ok) throw new Error('test fixture invalid')

    await expect(session.sendEstimate('item-1', estimate.value, 0)).rejects.toMatchObject(
      {
        kind: 'disconnected',
      },
    )
    await expect(session.requestSnapshot()).rejects.toMatchObject({
      kind: 'disconnected',
    })
    expect(fakeRoom.requestActionsByName.submitEstimate!.request).not.toHaveBeenCalled()
    expect(fakeRoom.requestActionsByName.requestSnapshot!.request).not.toHaveBeenCalled()
  })

  it('refuses an estimate and a snapshot request from another peer', () => {
    joinAsParticipant('session-abc')
    const estimate = { participantId: 'p-2', best: 1, likely: 2, worst: 3 }

    expect(answer('submitEstimate', { itemId: 'item-1', estimate }, 'peer-x')).toThrow()
    expect(answer('requestSnapshot', null, 'peer-x')).toThrow()
  })
})

/** A diagnostics log that keeps what it's given, for asserting on. */
function fakeDiagnostics() {
  const events: DiagnosticEvent[] = []
  const diagnostics: DiagnosticsLog = {
    record: (event) => events.push(event),
    read: () => ({ available: true, entries: [], userAgent: '' }),
    clear: () => {},
  }
  return { events, diagnostics }
}

describe('createJoinSession', () => {
  it('records peers joining and leaving by a shortened peer id', () => {
    const { events, diagnostics } = fakeDiagnostics()
    createJoinSession({ diagnostics }).asParticipant('session-abc')

    fakeRoom.onPeerJoin?.('abcdefghijklmnop')
    fakeRoom.onPeerLeave?.('abcdefghijklmnop')

    expect(events).toEqual([
      { kind: 'peer-join', peer: 'abcdef' },
      { kind: 'peer-leave', peer: 'abcdef' },
    ])
  })

  it("records Trystero's join error with the peer id shortened, and still disconnects", () => {
    const { events, diagnostics } = fakeDiagnostics()
    const session = createJoinSession({ diagnostics }).asParticipant('session-abc')
    const onJoinError = joinRoomMock.mock.calls[0]?.[2].onJoinError
    if (!onJoinError) throw new Error('expected onJoinError callback')

    onJoinError({
      error: 'incorrect password for overlapping room (abcdefghijklmnop)',
      appId: 'estimate-app-v1',
      roomId: 'session-abc',
      peerId: 'abcdefghijklmnop',
    })

    expect(events).toEqual([
      {
        kind: 'join-error',
        error: 'incorrect password for overlapping room (abcdef)',
        peer: 'abcdef',
      },
    ])
    expect(session.getConnectionState().status).toBe('disconnected')
  })

  it('records a join error that names no peer without one', () => {
    const { events, diagnostics } = fakeDiagnostics()
    createJoinSession({ diagnostics }).asParticipant('session-abc')
    const onJoinError = joinRoomMock.mock.calls[0]?.[2].onJoinError
    if (!onJoinError) throw new Error('expected onJoinError callback')

    onJoinError({
      error: 'relay refused',
      appId: 'estimate-app-v1',
      roomId: 'session-abc',
      peerId: '',
    })

    expect(events).toEqual([{ kind: 'join-error', error: 'relay refused' }])
  })

  it('hands Trystero a recording RTCPeerConnection that records into the log', () => {
    class BrowserPeerConnection extends EventTarget {}
    vi.stubGlobal('RTCPeerConnection', BrowserPeerConnection)
    try {
      const { diagnostics } = fakeDiagnostics()
      createJoinSession({ diagnostics }).asParticipant('session-abc')

      const polyfill = joinRoomMock.mock.calls[0]?.[0].rtcPolyfill
      expect(polyfill && new polyfill()).toBeInstanceOf(BrowserPeerConnection)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('records a peer that Trystero reports twice only once', () => {
    const { events, diagnostics } = fakeDiagnostics()
    createJoinSession({ diagnostics }).asParticipant('session-abc')

    fakeRoom.onPeerJoin?.('abcdefghijklmnop')
    fakeRoom.onPeerJoin?.('abcdefghijklmnop')

    expect(events).toEqual([{ kind: 'peer-join', peer: 'abcdef' }])
  })

  it('hands every join the same recording class, so attempts are numbered across rejoins', () => {
    vi.stubGlobal('RTCPeerConnection', class extends EventTarget {})
    try {
      const { diagnostics } = fakeDiagnostics()
      const join = createJoinSession({ diagnostics })
      join.asFacilitator('session-abc')
      join.asParticipant('session-abc')

      const [first, second] = joinRoomMock.mock.calls.map(
        ([config]) => config.rtcPolyfill,
      )
      expect(first).toBeDefined()
      expect(second).toBe(first)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
