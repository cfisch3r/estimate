import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLiveSession, type ConnectionState } from '../application/composition'
import { LiveSessionProvider } from './LiveSessionProvider'
import { useConnectionStore } from '../application/testing'

const { joinSessionMock, fakeSession } = vi.hoisted(() => {
  const state: ConnectionState = { status: 'connecting', peerIds: [] }
  const noopSubscribe = () => vi.fn(() => () => {})
  const fakeSession = {
    getConnectionState: () => state,
    onConnectionStateChange: noopSubscribe(),
    onEstimate: noopSubscribe(),
    onAnnounce: noopSubscribe(),
    onSnapshotRequest: noopSubscribe(),
    onPeerJoin: noopSubscribe(),
    onPeerLeave: noopSubscribe(),
    sendSnapshot: vi.fn(),
    sendAnnounce: vi.fn(),
    leave: vi.fn(),
  }
  // The store's role is the facilitator's by default, so only that join is used.
  const joinSessionMock = { asFacilitator: vi.fn(() => fakeSession) }
  return { joinSessionMock, fakeSession }
})

vi.mock('../adapters/network/session', () => ({
  createJoinSession: () => joinSessionMock,
}))

const diagnostics = {
  record: vi.fn(),
  read: () => ({ available: true, entries: [], userAgent: '' }),
  clear: vi.fn(),
}

function Consumer() {
  const { connect } = useLiveSession()
  return <button onClick={() => connect('K7F9Q2')}>connect</button>
}

beforeEach(() => {
  joinSessionMock.asFacilitator.mockClear()
  fakeSession.leave.mockClear()
  useConnectionStore.setState({ connectionStatus: 'idle', peerCount: 0 })
})

describe('LiveSessionProvider', () => {
  it('throws when used outside a LiveSessionProvider', () => {
    expect(() => render(<Consumer />)).toThrow(/LiveSessionProvider/)
  })

  it('joins the room and primes connection state on connect', async () => {
    const user = userEvent.setup()
    render(
      <LiveSessionProvider diagnostics={diagnostics}>
        <Consumer />
      </LiveSessionProvider>,
    )

    await user.click(screen.getByText('connect'))

    expect(joinSessionMock.asFacilitator).toHaveBeenCalledWith('K7F9Q2')
    expect(useConnectionStore.getState().connectionStatus).toBe('connecting')
  })

  it('leaves the room when the provider unmounts', async () => {
    const user = userEvent.setup()
    const { unmount } = render(
      <LiveSessionProvider diagnostics={diagnostics}>
        <Consumer />
      </LiveSessionProvider>,
    )
    await user.click(screen.getByText('connect'))
    fakeSession.leave.mockClear()

    unmount()

    expect(fakeSession.leave).toHaveBeenCalled()
  })
})
