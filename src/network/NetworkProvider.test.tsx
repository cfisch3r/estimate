import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ConnectionState } from './connection'
import { NetworkProvider } from './NetworkProvider'
import { useNetworkSession } from './useNetworkSession'
import { useSessionStore } from '../state/store'

const { joinSessionMock, fakeSession, emitState, emit } = vi.hoisted(() => {
  let listener: ((state: ConnectionState) => void) | null = null
  let current: ConnectionState = { status: 'connecting', peerIds: [] }
  const handlers: Record<string, ((...args: never[]) => void) | null> = {
    estimate: null,
    syncState: null,
    reveal: null,
    roundReset: null,
    announce: null,
    peerJoin: null,
  }
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
    onReveal: vi.fn(capture('reveal')),
    onRoundReset: vi.fn(capture('roundReset')),
    onAnnounce: vi.fn(capture('announce')),
    onPeerJoin: vi.fn(capture('peerJoin')),
    sendEstimate: vi.fn(),
    sendSyncState: vi.fn(),
    sendReveal: vi.fn(),
    sendRoundReset: vi.fn(),
    sendAnnounce: vi.fn(),
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

vi.mock('./session', () => ({ joinSession: joinSessionMock }))

function Consumer() {
  const { connect, disconnect } = useNetworkSession()
  return (
    <>
      <button onClick={() => connect('K7F9Q2')}>connect</button>
      <button onClick={disconnect}>disconnect</button>
    </>
  )
}

beforeEach(() => {
  joinSessionMock.mockClear()
  fakeSession.leave.mockClear()
  fakeSession.onConnectionStateChange.mockClear()
  fakeSession.sendEstimate.mockClear()
  fakeSession.sendSyncState.mockClear()
  fakeSession.sendAnnounce.mockClear()
  emitState({ status: 'connecting', peerIds: [] })
  useSessionStore.setState({
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

describe('useNetworkSession', () => {
  it('throws when used outside a NetworkProvider', () => {
    expect(() => render(<Consumer />)).toThrow(/NetworkProvider/)
  })

  it('joins the room and primes connection state on connect', async () => {
    const user = userEvent.setup()
    render(
      <NetworkProvider>
        <Consumer />
      </NetworkProvider>,
    )

    await user.click(screen.getByText('connect'))

    expect(joinSessionMock).toHaveBeenCalledWith('K7F9Q2')
    expect(useSessionStore.getState().connectionStatus).toBe('connecting')
  })

  it('mirrors later connection-state changes into the store', async () => {
    const user = userEvent.setup()
    render(
      <NetworkProvider>
        <Consumer />
      </NetworkProvider>,
    )
    await user.click(screen.getByText('connect'))

    act(() => emitState({ status: 'connected', peerIds: ['p1', 'p2'] }))

    expect(useSessionStore.getState().connectionStatus).toBe('connected')
    expect(useSessionStore.getState().peerCount).toBe(2)
  })

  it('tears down the room and resets the store on disconnect', async () => {
    const user = userEvent.setup()
    render(
      <NetworkProvider>
        <Consumer />
      </NetworkProvider>,
    )
    await user.click(screen.getByText('connect'))

    await user.click(screen.getByText('disconnect'))

    expect(fakeSession.leave).toHaveBeenCalled()
    expect(useSessionStore.getState().connectionStatus).toBe('idle')
    expect(useSessionStore.getState().peerCount).toBe(0)
  })

  it('dispatches incoming syncState / estimate / reveal / roundReset into the store', async () => {
    const user = userEvent.setup()
    act(() => useSessionStore.setState({ mode: 'live', role: 'participant' }))
    render(
      <NetworkProvider>
        <Consumer />
      </NetworkProvider>,
    )
    await user.click(screen.getByText('connect'))

    const item = { id: 'item-1', title: 'Retry queue', description: 'backoff' }
    act(() =>
      emit('syncState', {
        currentItem: item,
        unit: 'days',
        revealed: false,
        submissions: [],
        finalizedItemIds: [],
      }),
    )
    expect(useSessionStore.getState().liveRound?.item.title).toBe('Retry queue')

    act(() =>
      emit('estimate', 'item-1', { participantId: 'p2', best: 2, likely: 4, worst: 8 }),
    )
    expect(useSessionStore.getState().liveRound?.submissions).toHaveLength(1)

    act(() => emit('reveal', 'item-1'))
    expect(useSessionStore.getState().liveRound?.revealed).toBe(true)

    act(() => emit('roundReset', 'item-1'))
    expect(useSessionStore.getState().liveRound?.revealed).toBe(false)
    expect(useSessionStore.getState().liveRound?.submissions).toHaveLength(0)
  })

  it('re-broadcasts the facilitator snapshot when a peer joins', async () => {
    const user = userEvent.setup()
    render(
      <NetworkProvider>
        <Consumer />
      </NetworkProvider>,
    )
    await user.click(screen.getByText('connect'))

    act(() =>
      useSessionStore.setState({
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
          },
        ],
        activeItemId: 'i1',
        unit: 'weeks',
      }),
    )
    fakeSession.sendSyncState.mockClear()

    act(() => emit('peerJoin', 'peer-new'))

    expect(fakeSession.sendSyncState).toHaveBeenCalledWith(
      expect.objectContaining({
        currentItem: { id: 'i1', title: 'Retry queue', description: 'backoff' },
        unit: 'weeks',
        revealed: false,
      }),
    )
  })

  it('broadcasts revealed:true once the facilitator reveals the active item', async () => {
    const user = userEvent.setup()
    render(
      <NetworkProvider>
        <Consumer />
      </NetworkProvider>,
    )
    await user.click(screen.getByText('connect'))

    act(() =>
      useSessionStore.setState({
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
          },
        ],
        activeItemId: 'i1',
      }),
    )
    fakeSession.sendSyncState.mockClear()

    act(() => useSessionStore.getState().revealRound('i1'))

    expect(fakeSession.sendSyncState).toHaveBeenCalledWith(
      expect.objectContaining({ revealed: true }),
    )
  })

  it('announces the local participant on connect and applies inbound announces', async () => {
    const user = userEvent.setup()
    act(() =>
      useSessionStore.setState({
        mode: 'live',
        role: 'participant',
        participantId: 'p-self',
        myName: 'Sam Rivera',
      }),
    )
    render(
      <NetworkProvider>
        <Consumer />
      </NetworkProvider>,
    )

    await user.click(screen.getByText('connect'))

    expect(fakeSession.sendAnnounce).toHaveBeenCalledWith({
      participantId: 'p-self',
      name: 'Sam Rivera',
    })

    act(() => emit('announce', { participantId: 'p-2', name: 'Jordan' }))
    expect(useSessionStore.getState().participantNames['p-2']).toBe('Jordan')
  })

  it('re-announces the local client when a peer joins', async () => {
    const user = userEvent.setup()
    act(() =>
      useSessionStore.setState({
        mode: 'live',
        role: 'facilitator',
        myName: 'Facilitator',
      }),
    )
    render(
      <NetworkProvider>
        <Consumer />
      </NetworkProvider>,
    )
    await user.click(screen.getByText('connect'))
    fakeSession.sendAnnounce.mockClear()

    act(() => emit('peerJoin', 'peer-new'))

    expect(fakeSession.sendAnnounce).toHaveBeenCalledWith({
      participantId: 'facilitator',
      name: 'Facilitator',
    })
  })

  it('stops dispatching store updates after disconnect', async () => {
    const user = userEvent.setup()
    render(
      <NetworkProvider>
        <Consumer />
      </NetworkProvider>,
    )
    await user.click(screen.getByText('connect'))
    await user.click(screen.getByText('disconnect'))

    act(() =>
      emit('syncState', {
        currentItem: { id: 'x', title: 'late', description: '' },
        unit: 'days',
        revealed: false,
        submissions: [],
        finalizedItemIds: [],
      }),
    )

    expect(useSessionStore.getState().liveRound).toBeNull()
  })

  it('leaves the room when the provider unmounts', async () => {
    const user = userEvent.setup()
    const { unmount } = render(
      <NetworkProvider>
        <Consumer />
      </NetworkProvider>,
    )
    await user.click(screen.getByText('connect'))
    fakeSession.leave.mockClear()

    unmount()

    expect(fakeSession.leave).toHaveBeenCalled()
  })
})
