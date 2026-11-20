import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createJoinSession, joinSession } from './session'
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

describe('joinSession', () => {
  it('joins the trystero room using the session id as the room id', () => {
    joinSession('session-abc')

    expect(joinRoomMock).toHaveBeenCalledWith(
      expect.objectContaining({ appId: expect.any(String) }),
      'session-abc',
      expect.anything(),
    )
  })

  it('passes an optional password through to the room config', () => {
    joinSession('session-abc', { password: 'shh' })

    expect(joinRoomMock).toHaveBeenCalledWith(
      expect.objectContaining({ password: 'shh' }),
      'session-abc',
      expect.anything(),
    )
  })

  it('reflects a peer join in getConnectionState', () => {
    const session = joinSession('session-abc')

    fakeRoom.onPeerJoin?.('peer-1')

    expect(session.getConnectionState()).toEqual({
      status: 'connected',
      peerIds: ['peer-1'],
    })
  })

  it('notifies onPeerLeave subscribers when a peer leaves', () => {
    const session = joinSession('session-abc')
    fakeRoom.onPeerJoin?.('peer-1')
    const cb = vi.fn()
    session.onPeerLeave(cb)

    fakeRoom.onPeerLeave?.('peer-1')

    expect(cb).toHaveBeenCalledWith('peer-1')
  })

  it('marks the connection disconnected on a join error', () => {
    joinSession('session-abc')
    const onJoinError = joinRoomMock.mock.calls[0]?.[2].onJoinError
    if (!onJoinError) throw new Error('expected onJoinError callback')

    const session = joinSession('session-other')
    const onJoinErrorForSession = joinRoomMock.mock.calls[1]?.[2].onJoinError
    if (!onJoinErrorForSession) throw new Error('expected onJoinError callback')
    onJoinErrorForSession({
      error: 'incorrect password',
      appId: 'estimate-app-v1',
      roomId: 'session-other',
      peerId: 'peer-1',
    })

    expect(session.getConnectionState().status).toBe('disconnected')
    expect(typeof onJoinError).toBe('function')
  })

  it('leave() tears down the underlying room', () => {
    const session = joinSession('session-abc')

    session.leave()

    expect(fakeRoom.leave).toHaveBeenCalled()
  })

  it('sendEstimate delegates to the underlying submitEstimate request action, targeted at the given peer', async () => {
    const session = joinSession('session-abc')
    const estimate = createEstimate({ participantId: 'a', best: 1, likely: 2, worst: 3 })
    if (!estimate.ok) throw new Error('test fixture invalid')
    fakeRoom.requestActionsByName.submitEstimate!.request.mockResolvedValue({ ok: true })

    await session.sendEstimate('item-1', estimate.value, 2, 'facilitator-peer')

    expect(fakeRoom.requestActionsByName.submitEstimate!.request).toHaveBeenCalledWith(
      { itemId: 'item-1', estimate: estimate.value, round: 2 },
      { target: 'facilitator-peer', timeoutMs: 800 },
    )
  })

  it('requestSnapshot delegates to the underlying requestSnapshot action', async () => {
    const session = joinSession('session-abc')
    const snapshot = {
      currentItem: null,
      sessionName: '',
      unit: 'days' as const,
      revealed: false,
      round: 0,
      roster: [],
      submissions: [],
      finalizedItemIds: [],
    }
    fakeRoom.requestActionsByName.requestSnapshot!.request.mockResolvedValue(snapshot)

    const result = await session.requestSnapshot('peer-1')

    expect(fakeRoom.requestActionsByName.requestSnapshot!.request).toHaveBeenCalledWith(
      null,
      { target: 'peer-1', timeoutMs: 800 },
    )
    expect(result).toEqual(snapshot)
  })

  it('onRequestSnapshot registers a responder on the underlying requestSnapshot action', () => {
    const session = joinSession('session-abc')
    const snapshot = {
      currentItem: null,
      sessionName: '',
      unit: 'days' as const,
      revealed: false,
      round: 0,
      roster: [],
      submissions: [],
      finalizedItemIds: [],
    }
    session.onRequestSnapshot(() => snapshot)

    const onRequest = fakeRoom.requestActionsByName.requestSnapshot!.onRequest as (
      data: unknown,
      context: { peerId: string },
    ) => unknown
    expect(onRequest(null, { peerId: 'peer-2' })).toBe(snapshot)
  })

  it('sendAnnounce delegates to the underlying announce action', () => {
    const session = joinSession('session-abc')

    session.sendAnnounce({ participantId: 'p-1', name: 'Sam Rivera' })

    expect(fakeRoom.actionsByName.announce!.send).toHaveBeenCalledWith({
      participantId: 'p-1',
      name: 'Sam Rivera',
    })
  })

  it('onAnnounce subscribers receive validated inbound announce messages', () => {
    const session = joinSession('session-abc')
    const cb = vi.fn()
    session.onAnnounce(cb)

    const onMessage = fakeRoom.actionsByName.announce!.onMessage as (
      data: unknown,
      context: { peerId: string },
    ) => void
    onMessage({ participantId: 'p-2', name: '  Jordan  ' }, { peerId: 'peer-2' })

    expect(cb).toHaveBeenCalledWith({ participantId: 'p-2', name: 'Jordan' }, 'peer-2')
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
    createJoinSession({ diagnostics })('session-abc')

    fakeRoom.onPeerJoin?.('abcdefghijklmnop')
    fakeRoom.onPeerLeave?.('abcdefghijklmnop')

    expect(events).toEqual([
      { kind: 'peer-join', peer: 'abcdef' },
      { kind: 'peer-leave', peer: 'abcdef' },
    ])
  })

  it("records Trystero's join error with the peer id shortened, and still disconnects", () => {
    const { events, diagnostics } = fakeDiagnostics()
    const session = createJoinSession({ diagnostics })('session-abc')
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
    createJoinSession({ diagnostics })('session-abc')
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
      createJoinSession({ diagnostics })('session-abc')

      const polyfill = joinRoomMock.mock.calls[0]?.[0].rtcPolyfill
      expect(polyfill && new polyfill()).toBeInstanceOf(BrowserPeerConnection)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('records a peer that Trystero reports twice only once', () => {
    const { events, diagnostics } = fakeDiagnostics()
    createJoinSession({ diagnostics })('session-abc')

    fakeRoom.onPeerJoin?.('abcdefghijklmnop')
    fakeRoom.onPeerJoin?.('abcdefghijklmnop')

    expect(events).toEqual([{ kind: 'peer-join', peer: 'abcdef' }])
  })

  it('hands every join the same recording class, so attempts are numbered across rejoins', () => {
    vi.stubGlobal('RTCPeerConnection', class extends EventTarget {})
    try {
      const { diagnostics } = fakeDiagnostics()
      const join = createJoinSession({ diagnostics })
      join('session-abc')
      join('session-abc')

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
