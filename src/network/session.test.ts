import { describe, expect, it, vi, beforeEach } from 'vitest'
import { joinSession } from './session'
import { createEstimate } from '../calc'

const { joinRoomMock, fakeRoom } = vi.hoisted(() => {
  const actionsByName: Record<
    string,
    { send: ReturnType<typeof vi.fn>; onMessage: unknown }
  > = {}
  const fakeRoom = {
    makeAction: vi.fn((name: string) => {
      actionsByName[name] = { send: vi.fn(), onMessage: null }
      return actionsByName[name]
    }),
    onPeerJoin: null as ((peerId: string) => void) | null,
    onPeerLeave: null as ((peerId: string) => void) | null,
    leave: vi.fn(),
    actionsByName,
  }
  const joinRoomMock = vi.fn(
    (
      _config: { appId: string; password?: string },
      _roomId: string,
      _callbacks: { onJoinError: () => void },
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
    onJoinErrorForSession()

    expect(session.getConnectionState().status).toBe('disconnected')
    expect(typeof onJoinError).toBe('function')
  })

  it('leave() tears down the underlying room', () => {
    const session = joinSession('session-abc')

    session.leave()

    expect(fakeRoom.leave).toHaveBeenCalled()
  })

  it('sendEstimate delegates to the underlying submitEstimate action', () => {
    const session = joinSession('session-abc')
    const estimate = createEstimate({ participantId: 'a', best: 1, likely: 2, worst: 3 })
    if (!estimate.ok) throw new Error('test fixture invalid')

    session.sendEstimate(estimate.value)

    expect(fakeRoom.actionsByName.submitEstimate!.send).toHaveBeenCalledWith(
      estimate.value,
    )
  })

  it('sendReveal and sendRoundReset delegate to their underlying actions', () => {
    const session = joinSession('session-abc')

    session.sendReveal('item-1')
    session.sendRoundReset('item-1')

    expect(fakeRoom.actionsByName.reveal!.send).toHaveBeenCalledWith('item-1')
    expect(fakeRoom.actionsByName.roundReset!.send).toHaveBeenCalledWith('item-1')
  })

  it('onRoundReset subscribers receive validated inbound roundReset messages', () => {
    const session = joinSession('session-abc')
    const cb = vi.fn()
    session.onRoundReset(cb)

    const onMessage = fakeRoom.actionsByName.roundReset!.onMessage as (
      data: unknown,
      context: { peerId: string },
    ) => void
    onMessage('item-1', { peerId: 'peer-2' })

    expect(cb).toHaveBeenCalledWith('item-1', 'peer-2')
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
