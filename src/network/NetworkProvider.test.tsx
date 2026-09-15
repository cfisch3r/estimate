import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ConnectionState } from './connection'
import { NetworkProvider } from './NetworkProvider'
import { useNetworkSession } from './useNetworkSession'
import { createEstimate } from '../calc'
import { useSessionStore } from '../state/store'

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
  fakeSession.requestSnapshot.mockClear()
  fakeSession.sendEstimate.mockImplementation(() => Promise.resolve())
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

afterEach(() => {
  vi.useRealTimers()
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

  it('does not report a participant as connected until the facilitator announces', async () => {
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

    // Reaches a peer, but it isn't the facilitator yet.
    act(() => emitState({ status: 'connected', peerIds: ['peer-other'] }))

    expect(useSessionStore.getState().connectionStatus).toBe('connecting')
    expect(useSessionStore.getState().peerCount).toBe(1)
  })

  it("flips a participant to connected once the facilitator's announce arrives", async () => {
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

    act(() => emitState({ status: 'connected', peerIds: ['peer-fac'] }))
    expect(useSessionStore.getState().connectionStatus).toBe('connecting')

    act(() => {
      emit('announce', { participantId: 'facilitator', name: 'Facilitator' }, 'peer-fac')
    })

    expect(useSessionStore.getState().connectionStatus).toBe('connected')
  })

  it('drops a participant back to connecting (not disconnected) when only the facilitator peer leaves', async () => {
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

    act(() => emitState({ status: 'connected', peerIds: ['peer-fac', 'peer-other'] }))
    act(() => {
      emit('announce', { participantId: 'facilitator', name: 'Facilitator' }, 'peer-fac')
      emit('announce', { participantId: 'p-other', name: 'Other' }, 'peer-other')
    })
    expect(useSessionStore.getState().connectionStatus).toBe('connected')

    // Mirrors connection.ts's real ordering: the tracker's own state-change
    // fires before its peer-leave listeners, so the raw peer count drops
    // first (leaving connectionStatus stale at 'connected', since peer-other
    // is still up) and only the onPeerLeave handler's facilitator-departure
    // check corrects it back down.
    act(() => {
      emitState({ status: 'connected', peerIds: ['peer-other'] })
      emit('peerLeave', 'peer-fac')
    })

    expect(useSessionStore.getState().connectionStatus).toBe('connecting')
    expect(useSessionStore.getState().peerCount).toBe(1)

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
    await act(async () => {
      emit('announce', { participantId: 'facilitator', name: 'Facilitator' }, 'peer-fac-2')
      await Promise.resolve()
    })
    expect(fakeSession.requestSnapshot).toHaveBeenCalledWith('peer-fac-2')
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

  it('dispatches incoming syncState into the store, including reveal and Retry via later snapshots', async () => {
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
        round: 0,
        roster: [{ participantId: 'p2', submitted: true, connected: true }],
        submissions: [],
        finalizedItemIds: [],
      }),
    )
    expect(useSessionStore.getState().liveRound?.item.title).toBe('Retry queue')
    expect(useSessionStore.getState().liveRound?.roster).toHaveLength(1)

    // A later snapshot carries the reveal — there's no separate one-shot event
    // any more (ADR-003, "Versioned rounds").
    act(() =>
      emit('syncState', {
        currentItem: item,
        unit: 'days',
        revealed: true,
        round: 0,
        roster: [{ participantId: 'p2', submitted: true, connected: true }],
        submissions: [{ participantId: 'p2', best: 2, likely: 4, worst: 8 }],
        finalizedItemIds: [],
      }),
    )
    expect(useSessionStore.getState().liveRound?.revealed).toBe(true)

    // And a Retry is just a round bump on the next snapshot.
    act(() =>
      emit('syncState', {
        currentItem: item,
        unit: 'days',
        revealed: false,
        round: 1,
        roster: [],
        submissions: [],
        finalizedItemIds: [],
      }),
    )
    expect(useSessionStore.getState().liveRound?.revealed).toBe(false)
    expect(useSessionStore.getState().liveRound?.round).toBe(1)
  })

  it('does not record another peer’s estimate on a participant client (sendEstimate targets the facilitator only)', async () => {
    const user = userEvent.setup()
    act(() =>
      useSessionStore.setState({
        mode: 'live',
        role: 'participant',
        items: [],
        activeItemId: null,
      }),
    )
    render(
      <NetworkProvider>
        <Consumer />
      </NetworkProvider>,
    )
    await user.click(screen.getByText('connect'))

    act(() =>
      emit('estimate', 'item-1', { participantId: 'p2', best: 2, likely: 4, worst: 8 }),
    )

    expect(useSessionStore.getState().liveRound).toBeNull()
  })

  it('does not re-broadcast the snapshot on peer-join (a newcomer pulls it instead)', async () => {
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
            round: 0,
          },
        ],
        activeItemId: 'i1',
        unit: 'weeks',
      }),
    )
    fakeSession.sendSyncState.mockClear()

    act(() => emit('peerJoin', 'peer-new'))

    expect(fakeSession.sendSyncState).not.toHaveBeenCalled()
  })

  it('answers a requestSnapshot pull with the current facilitator snapshot', async () => {
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
            round: 0,
          },
        ],
        activeItemId: 'i1',
        unit: 'weeks',
      }),
    )

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

    await act(async () => {
      emit('announce', { participantId: 'facilitator', name: 'Facilitator' }, 'peer-fac')
      await Promise.resolve()
    })

    expect(fakeSession.requestSnapshot).toHaveBeenCalledWith('peer-fac')
    expect(useSessionStore.getState().liveRound?.item.title).toBe('Retry queue')
  })

  it("does not re-pull when the facilitator's peerId is re-announced unchanged", async () => {
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

    fakeSession.requestSnapshot.mockResolvedValue({
      currentItem: null,
      unit: 'days' as const,
      revealed: false,
      round: 0,
      roster: [],
      submissions: [],
      finalizedItemIds: [],
    })

    await act(async () => {
      emit('announce', { participantId: 'facilitator', name: 'Facilitator' }, 'peer-fac')
      await Promise.resolve()
    })
    fakeSession.requestSnapshot.mockClear()

    // A different peer joining re-triggers every client's announce, including
    // the facilitator's own — re-announcing the same peerId must not re-pull.
    act(() =>
      emit('announce', { participantId: 'facilitator', name: 'Facilitator' }, 'peer-fac'),
    )

    expect(fakeSession.requestSnapshot).not.toHaveBeenCalled()
  })

  it("targets sendEstimate at the facilitator's peerId once learned", async () => {
    const user = userEvent.setup()
    act(() =>
      useSessionStore.setState({
        mode: 'live',
        role: 'participant',
        participantId: 'p-self',
        myName: 'Sam Rivera',
      }),
    )
    function EstimateSender() {
      const { sendEstimate } = useNetworkSession()
      return (
        <button
          onClick={() => {
            const estimate = createEstimate({
              participantId: 'p-self',
              best: 1,
              likely: 2,
              worst: 3,
            })
            if (estimate.ok) sendEstimate('i1', estimate.value, 0).catch(() => {})
          }}
        >
          submit
        </button>
      )
    }
    render(
      <NetworkProvider>
        <EstimateSender />
        <Consumer />
      </NetworkProvider>,
    )
    await user.click(screen.getByText('connect'))
    fakeSession.requestSnapshot.mockResolvedValue({
      currentItem: null,
      unit: 'days' as const,
      revealed: false,
      round: 0,
      roster: [],
      submissions: [],
      finalizedItemIds: [],
    })

    await act(async () => {
      emit('announce', { participantId: 'facilitator', name: 'Facilitator' }, 'peer-fac')
      await Promise.resolve()
    })

    await user.click(screen.getByText('submit'))

    expect(fakeSession.sendEstimate).toHaveBeenCalledWith(
      'i1',
      expect.objectContaining({ participantId: 'p-self' }),
      0,
      'peer-fac',
    )
  })

  it("never falls back to an untargeted broadcast when the facilitator's peerId isn't known yet", async () => {
    const user = userEvent.setup()
    act(() =>
      useSessionStore.setState({
        mode: 'live',
        role: 'participant',
        participantId: 'p-self',
        myName: 'Sam Rivera',
      }),
    )
    function EstimateSender() {
      const { sendEstimate } = useNetworkSession()
      return (
        <button
          onClick={() => {
            const estimate = createEstimate({
              participantId: 'p-self',
              best: 1,
              likely: 2,
              worst: 3,
            })
            if (estimate.ok) sendEstimate('i1', estimate.value, 0).catch(() => {})
          }}
        >
          submit
        </button>
      )
    }
    render(
      <NetworkProvider>
        <EstimateSender />
        <Consumer />
      </NetworkProvider>,
    )
    await user.click(screen.getByText('connect'))

    // No announce from the facilitator has arrived yet, so its peerId is unknown.
    await user.click(screen.getByText('submit'))

    expect(fakeSession.sendEstimate).not.toHaveBeenCalled()
  })

  it('retries a sendEstimate that times out, and delivers on the retry', async () => {
    vi.useFakeTimers()
    act(() =>
      useSessionStore.setState({
        mode: 'live',
        role: 'participant',
        participantId: 'p-self',
        myName: 'Sam Rivera',
      }),
    )
    let capturedSend: ((itemId: string, estimate: unknown, round: number) => Promise<void>) | null =
      null
    function Capture() {
      const { sendEstimate } = useNetworkSession()
      capturedSend = sendEstimate
      return null
    }
    render(
      <NetworkProvider>
        <Capture />
        <Consumer />
      </NetworkProvider>,
    )
    act(() => screen.getByText('connect').click())
    fakeSession.requestSnapshot.mockResolvedValue({
      currentItem: null,
      unit: 'days' as const,
      revealed: false,
      round: 0,
      roster: [],
      submissions: [],
      finalizedItemIds: [],
    })
    await act(async () => {
      emit('announce', { participantId: 'facilitator', name: 'Facilitator' }, 'peer-fac')
      await Promise.resolve()
    })

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
    const sendPromise = capturedSend!('i1', estimate.value, 0).then(() => {
      resolved = true
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })
    await sendPromise

    expect(resolved).toBe(true)
    expect(fakeSession.sendEstimate).toHaveBeenCalledTimes(2)
  })

  it('does not retry a sendEstimate that fails as disconnected', async () => {
    act(() =>
      useSessionStore.setState({
        mode: 'live',
        role: 'participant',
        participantId: 'p-self',
        myName: 'Sam Rivera',
      }),
    )
    let capturedSend: ((itemId: string, estimate: unknown, round: number) => Promise<void>) | null =
      null
    function Capture() {
      const { sendEstimate } = useNetworkSession()
      capturedSend = sendEstimate
      return null
    }
    render(
      <NetworkProvider>
        <Capture />
        <Consumer />
      </NetworkProvider>,
    )
    act(() => screen.getByText('connect').click())
    fakeSession.requestSnapshot.mockResolvedValue({
      currentItem: null,
      unit: 'days' as const,
      revealed: false,
      round: 0,
      roster: [],
      submissions: [],
      finalizedItemIds: [],
    })
    await act(async () => {
      emit('announce', { participantId: 'facilitator', name: 'Facilitator' }, 'peer-fac')
      await Promise.resolve()
    })

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

    await expect(capturedSend!('i1', estimate.value, 0)).rejects.toBe(disconnectedError)
    expect(fakeSession.sendEstimate).toHaveBeenCalledTimes(1)
  })

  it('resends this participant’s estimate when a snapshot shows it not yet in the roster', async () => {
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
    act(() => screen.getByText('connect').click())
    fakeSession.requestSnapshot.mockResolvedValue({
      currentItem: { id: 'i1', title: 'Item', description: '' },
      unit: 'days' as const,
      revealed: false,
      round: 0,
      roster: [],
      submissions: [],
      finalizedItemIds: [],
    })
    await act(async () => {
      emit('announce', { participantId: 'facilitator', name: 'Facilitator' }, 'peer-fac')
      await Promise.resolve()
    })
    act(() =>
      useSessionStore.getState().submitEstimate(1, 2, 3),
    )
    fakeSession.sendEstimate.mockClear()

    await act(async () => {
      emit('syncState', {
        currentItem: { id: 'i1', title: 'Item', description: '' },
        unit: 'days',
        revealed: false,
        round: 0,
        roster: [{ participantId: 'p-self', submitted: false, connected: true }],
        submissions: [],
        finalizedItemIds: [],
      })
      await Promise.resolve()
    })

    expect(fakeSession.sendEstimate).toHaveBeenCalledWith(
      'i1',
      expect.objectContaining({ participantId: 'p-self', best: 1, likely: 2, worst: 3 }),
      0,
      'peer-fac',
    )
  })

  it('does not resend when the roster already shows this participant as submitted', async () => {
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
    act(() => screen.getByText('connect').click())
    fakeSession.requestSnapshot.mockResolvedValue({
      currentItem: { id: 'i1', title: 'Item', description: '' },
      unit: 'days' as const,
      revealed: false,
      round: 0,
      roster: [],
      submissions: [],
      finalizedItemIds: [],
    })
    await act(async () => {
      emit('announce', { participantId: 'facilitator', name: 'Facilitator' }, 'peer-fac')
      await Promise.resolve()
    })
    act(() =>
      useSessionStore.getState().submitEstimate(1, 2, 3),
    )
    fakeSession.sendEstimate.mockClear()

    await act(async () => {
      emit('syncState', {
        currentItem: { id: 'i1', title: 'Item', description: '' },
        unit: 'days',
        revealed: false,
        round: 0,
        roster: [{ participantId: 'p-self', submitted: true, connected: true }],
        submissions: [],
        finalizedItemIds: [],
      })
      await Promise.resolve()
    })

    expect(fakeSession.sendEstimate).not.toHaveBeenCalled()
  })

  it('does not stack a second roster-triggered resend while one is already in flight', async () => {
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
    act(() => screen.getByText('connect').click())
    fakeSession.requestSnapshot.mockResolvedValue({
      currentItem: { id: 'i1', title: 'Item', description: '' },
      unit: 'days' as const,
      revealed: false,
      round: 0,
      roster: [],
      submissions: [],
      finalizedItemIds: [],
    })
    await act(async () => {
      emit('announce', { participantId: 'facilitator', name: 'Facilitator' }, 'peer-fac')
      await Promise.resolve()
    })
    act(() => useSessionStore.getState().submitEstimate(1, 2, 3))
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
    await act(async () => {
      emit('syncState', unsubmittedSnapshot)
      await Promise.resolve()
    })
    await act(async () => {
      emit('syncState', unsubmittedSnapshot)
      await Promise.resolve()
    })

    expect(fakeSession.sendEstimate).toHaveBeenCalledTimes(1)
  })

  it('resends against the facilitator’s current peerId if it changes mid-retry', async () => {
    vi.useFakeTimers()
    act(() =>
      useSessionStore.setState({
        mode: 'live',
        role: 'participant',
        participantId: 'p-self',
        myName: 'Sam Rivera',
      }),
    )
    let capturedSend: ((itemId: string, estimate: unknown, round: number) => Promise<void>) | null =
      null
    function Capture() {
      const { sendEstimate } = useNetworkSession()
      capturedSend = sendEstimate
      return null
    }
    render(
      <NetworkProvider>
        <Capture />
        <Consumer />
      </NetworkProvider>,
    )
    act(() => screen.getByText('connect').click())
    fakeSession.requestSnapshot.mockResolvedValue({
      currentItem: null,
      unit: 'days' as const,
      revealed: false,
      round: 0,
      roster: [],
      submissions: [],
      finalizedItemIds: [],
    })
    await act(async () => {
      emit('announce', { participantId: 'facilitator', name: 'Facilitator' }, 'peer-fac-old')
      await Promise.resolve()
    })

    const timeoutError = Object.assign(new Error('timed out'), { kind: 'timeout' })
    fakeSession.sendEstimate.mockRejectedValueOnce(timeoutError).mockResolvedValueOnce()

    const estimate = createEstimate({
      participantId: 'p-self',
      best: 1,
      likely: 2,
      worst: 3,
    })
    if (!estimate.ok) throw new Error('test fixture invalid')

    const sendPromise = capturedSend!('i1', estimate.value, 0)

    // The facilitator reconnects mid-retry, announcing under a new peerId.
    await act(async () => {
      emit('announce', { participantId: 'facilitator', name: 'Facilitator' }, 'peer-fac-new')
      await Promise.resolve()
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })
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
    const user = userEvent.setup()
    render(
      <NetworkProvider>
        <Consumer />
      </NetworkProvider>,
    )
    await user.click(screen.getByText('connect'))

    const sub = createEstimate({ participantId: 'p1', best: 2, likely: 4, worst: 8 })
    if (!sub.ok) throw new Error('bad fixture')

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
            submissions: [sub.value],
            revealed: false,
            round: 0,
          },
        ],
        activeItemId: 'i1',
      }),
    )
    fakeSession.sendSyncState.mockClear()

    act(() => useSessionStore.getState().revealRound('i1'))

    expect(fakeSession.sendSyncState).toHaveBeenCalledWith(
      expect.objectContaining({ revealed: true, submissions: [sub.value] }),
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

  it('prunes a participant from the roster once their peer connection leaves', async () => {
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

    act(() => emit('announce', { participantId: 'p-2', name: 'Jordan' }, 'peer-2'))
    expect(useSessionStore.getState().participantNames['p-2']).toBe('Jordan')

    act(() => emit('peerLeave', 'peer-2'))

    expect(useSessionStore.getState().participantNames['p-2']).toBeUndefined()
  })

  it('does not prune on a participant client (roster pruning is facilitator-only)', async () => {
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

    act(() => emit('announce', { participantId: 'p-2', name: 'Jordan' }, 'peer-2'))
    act(() => emit('peerLeave', 'peer-2'))

    expect(useSessionStore.getState().participantNames['p-2']).toBe('Jordan')
  })

  it('keeps a name backed by another live connection (two tabs, one participantId)', async () => {
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

    // Two tabs in the same browser share a participantId (see the JoinSession
    // warning) — each gets its own peerId.
    act(() => emit('announce', { participantId: 'p-2', name: 'Jordan' }, 'peer-2a'))
    act(() => emit('announce', { participantId: 'p-2', name: 'Jordan' }, 'peer-2b'))

    act(() => emit('peerLeave', 'peer-2a'))

    expect(useSessionStore.getState().participantNames['p-2']).toBe('Jordan')
  })

  it('keeps the name of a participant who already submitted this round', async () => {
    const user = userEvent.setup()
    const sub = createEstimate({ participantId: 'p-2', best: 2, likely: 4, worst: 8 })
    if (!sub.ok) throw new Error('bad fixture')
    act(() =>
      useSessionStore.setState({
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
      }),
    )
    render(
      <NetworkProvider>
        <Consumer />
      </NetworkProvider>,
    )
    await user.click(screen.getByText('connect'))

    act(() => emit('announce', { participantId: 'p-2', name: 'Jordan' }, 'peer-2'))
    act(() => emit('peerLeave', 'peer-2'))

    expect(useSessionStore.getState().participantNames['p-2']).toBe('Jordan')
  })

  it('does nothing when an unannounced peer leaves', async () => {
    const user = userEvent.setup()
    act(() =>
      useSessionStore.setState({
        mode: 'live',
        role: 'facilitator',
        myName: 'Facilitator',
        participantNames: { p2: 'Jordan' },
      }),
    )
    render(
      <NetworkProvider>
        <Consumer />
      </NetworkProvider>,
    )
    await user.click(screen.getByText('connect'))

    act(() => emit('peerLeave', 'peer-never-announced'))

    expect(useSessionStore.getState().participantNames).toEqual({ p2: 'Jordan' })
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
