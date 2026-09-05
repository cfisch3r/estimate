import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ParticipantEstimateView } from './ParticipantEstimateView'
import { useSessionStore } from '../state/store'

const { disconnectMock } = vi.hoisted(() => ({ disconnectMock: vi.fn() }))

vi.mock('../network', () => ({
  useNetworkSession: () => ({ connect: vi.fn(), disconnect: disconnectMock }),
}))

beforeEach(() => {
  disconnectMock.mockClear()
  useSessionStore.setState({
    currentScreen: 'estimate',
    mode: 'live',
    role: 'participant',
    sessionId: 'K7F9Q2',
    myName: 'Sam',
    connectionStatus: 'connecting',
    peerCount: 0,
  })
})

describe('ParticipantEstimateView', () => {
  it('waits for the facilitator once connected', () => {
    useSessionStore.setState({ connectionStatus: 'connected' })
    render(<ParticipantEstimateView />)

    expect(screen.getByText(/Waiting for the facilitator/)).toBeInTheDocument()
    expect(screen.getByText('Session K7F9Q2')).toBeInTheDocument()
  })

  it('leaves the session and returns to the create screen', async () => {
    const user = userEvent.setup()
    render(<ParticipantEstimateView />)

    await user.click(screen.getByRole('button', { name: 'Leave session' }))

    expect(disconnectMock).toHaveBeenCalled()
    expect(useSessionStore.getState()).toMatchObject({
      currentScreen: 'create',
      mode: 'manual',
      sessionId: null,
    })
  })
})
