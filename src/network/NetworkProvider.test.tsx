import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ConnectionState } from './connection'
import { NetworkProvider } from './NetworkProvider'
import { useNetworkSession } from './useNetworkSession'
import { useSessionStore } from '../state/store'

const { joinSessionMock, fakeSession, emitState } = vi.hoisted(() => {
  let listener: ((state: ConnectionState) => void) | null = null
  let current: ConnectionState = { status: 'connecting', peerIds: [] }
  const fakeSession = {
    getConnectionState: () => current,
    onConnectionStateChange: vi.fn((cb: (state: ConnectionState) => void) => {
      listener = cb
      return () => {
        listener = null
      }
    }),
    leave: vi.fn(),
  }
  const emitState = (state: ConnectionState) => {
    current = state
    listener?.(state)
  }
  return { joinSessionMock: vi.fn(() => fakeSession), fakeSession, emitState }
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
  emitState({ status: 'connecting', peerIds: [] })
  useSessionStore.setState({ connectionStatus: 'idle', peerCount: 0 })
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
