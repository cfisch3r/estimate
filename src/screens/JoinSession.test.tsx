import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JoinSession } from './JoinSession'
import { useSessionStore } from '../state/store'

const { connectMock, disconnectMock } = vi.hoisted(() => ({
  connectMock: vi.fn(),
  disconnectMock: vi.fn(),
}))

vi.mock('../network', () => ({
  useNetworkSession: () => ({ connect: connectMock, disconnect: disconnectMock }),
}))

function resetStore() {
  useSessionStore.setState({
    currentScreen: 'join',
    sessionName: '',
    unit: 'days',
    items: [],
    activeItemId: null,
    mode: 'manual',
    role: 'facilitator',
    sessionId: null,
    myName: '',
    connectionStatus: 'idle',
    peerCount: 0,
  })
}

beforeEach(() => {
  connectMock.mockClear()
  disconnectMock.mockClear()
  resetStore()
})

describe('JoinSession', () => {
  it('keeps Join disabled until both code and name are provided', async () => {
    const user = userEvent.setup()
    render(<JoinSession />)

    const join = screen.getByRole('button', { name: 'Join' })
    expect(join).toBeDisabled()

    await user.type(screen.getByLabelText('Session code'), 'k7f9q2')
    expect(join).toBeDisabled()

    await user.type(screen.getByLabelText('Your name'), 'Sam')
    expect(join).toBeEnabled()
  })

  it('joins with a normalised code and connects', async () => {
    const user = userEvent.setup()
    render(<JoinSession />)

    await user.type(screen.getByLabelText('Session code'), 'k7f9q2')
    await user.type(screen.getByLabelText('Your name'), 'Sam Rivera')
    await user.click(screen.getByRole('button', { name: 'Join' }))

    expect(useSessionStore.getState()).toMatchObject({
      mode: 'live',
      role: 'participant',
      sessionId: 'K7F9Q2',
      myName: 'Sam Rivera',
      connectionStatus: 'connecting',
    })
    expect(connectMock).toHaveBeenCalledWith('K7F9Q2')
  })

  it('shows the connecting indicator and disables Join while connecting', async () => {
    const user = userEvent.setup()
    render(<JoinSession />)
    await user.type(screen.getByLabelText('Session code'), 'K7F9Q2')
    await user.type(screen.getByLabelText('Your name'), 'Sam')

    act(() => useSessionStore.setState({ connectionStatus: 'connecting' }))

    expect(screen.getByText('Connecting to peers…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Join' })).toBeDisabled()
  })

  it('shows the failure banner with a Retry action when disconnected', () => {
    useSessionStore.setState({ connectionStatus: 'disconnected' })
    render(<JoinSession />)

    expect(screen.getByText(/Couldn.t reach the session/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('routes to the estimate view once this client has joined and is connected', async () => {
    const user = userEvent.setup()
    render(<JoinSession />)

    await user.type(screen.getByLabelText('Session code'), 'K7F9Q2')
    await user.type(screen.getByLabelText('Your name'), 'Sam')
    await user.click(screen.getByRole('button', { name: 'Join' }))
    expect(useSessionStore.getState().currentScreen).toBe('join')

    act(() => useSessionStore.setState({ connectionStatus: 'connected' }))

    expect(useSessionStore.getState().currentScreen).toBe('estimate')
  })

  it('does not route away on mount from a stale connected status it did not initiate', () => {
    useSessionStore.setState({ connectionStatus: 'connected' })
    render(<JoinSession />)

    expect(useSessionStore.getState().currentScreen).toBe('join')
  })

  it('Back disconnects and returns to the create screen', async () => {
    const user = userEvent.setup()
    render(<JoinSession />)

    await user.click(screen.getByRole('button', { name: '← Back' }))

    expect(disconnectMock).toHaveBeenCalled()
    expect(useSessionStore.getState().currentScreen).toBe('create')
  })
})
