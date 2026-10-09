import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useNetworkSession } from '../application'
import type { ConnectionState } from '../application/composition'
import { NetworkProvider } from './NetworkProvider'
import { useConnectionStore } from '../application/testing'

const { joinSessionMock, fakeSession } = vi.hoisted(() => {
  const state: ConnectionState = { status: 'connecting', peerIds: [] }
  const noopSubscribe = () => vi.fn(() => () => {})
  const fakeSession = {
    getConnectionState: () => state,
    onConnectionStateChange: noopSubscribe(),
    onEstimate: noopSubscribe(),
    onSyncState: noopSubscribe(),
    onAnnounce: noopSubscribe(),
    onRequestSnapshot: noopSubscribe(),
    onPeerJoin: noopSubscribe(),
    onPeerLeave: noopSubscribe(),
    sendEstimate: vi.fn(() => Promise.resolve()),
    sendSyncState: vi.fn(),
    sendAnnounce: vi.fn(),
    requestSnapshot: vi.fn(() => Promise.resolve()),
    leave: vi.fn(),
  }
  return { joinSessionMock: vi.fn(() => fakeSession), fakeSession }
})

vi.mock('../adapters/network/session', () => ({ joinSession: joinSessionMock }))

function Consumer() {
  const { connect } = useNetworkSession()
  return <button onClick={() => connect('K7F9Q2')}>connect</button>
}

beforeEach(() => {
  joinSessionMock.mockClear()
  fakeSession.leave.mockClear()
  useConnectionStore.setState({ connectionStatus: 'idle', peerCount: 0 })
})

describe('NetworkProvider', () => {
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
    expect(useConnectionStore.getState().connectionStatus).toBe('connecting')
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
