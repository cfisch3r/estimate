import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { JoinSession } from './JoinSession'
import { RECONNECT_GRACE_MS } from '../../../shared/lib/useConnectionPhase'
import {
  ParticipantIdentityContext,
  useSessionStore,
  useConnectionStore,
} from '../../../application'

const { connectMock, disconnectMock, navigateMock } = vi.hoisted(() => ({
  connectMock: vi.fn(),
  disconnectMock: vi.fn(),
  navigateMock: vi.fn(),
}))

vi.mock('../../../application/ports/useNetworkSession', () => ({
  useNetworkSession: () => ({ connect: connectMock, disconnect: disconnectMock }),
}))

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>()
  return { ...actual, useNavigate: () => navigateMock }
})

function renderJoinSession() {
  return render(
    <ParticipantIdentityContext.Provider
      value={{ getOrCreateParticipantId: () => 'p-1' }}
    >
      <MemoryRouter>
        <JoinSession />
      </MemoryRouter>
    </ParticipantIdentityContext.Provider>,
  )
}

function resetStore() {
  useSessionStore.setState({
    sessionName: '',
    unit: 'days',
    items: [],
    activeItemId: null,
  })
  useConnectionStore.setState({
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
  navigateMock.mockClear()
  resetStore()
})

describe('JoinSession', () => {
  it('warns about joining from a second tab in the same browser', () => {
    renderJoinSession()

    expect(screen.getByText(/another tab in this browser/i)).toBeInTheDocument()
  })

  it('keeps Join disabled until both code and name are provided', async () => {
    const user = userEvent.setup()
    renderJoinSession()

    const join = screen.getByRole('button', { name: 'Join' })
    expect(join).toBeDisabled()

    await user.type(screen.getByLabelText('Session code'), 'k7f9q2')
    expect(join).toBeDisabled()

    await user.type(screen.getByLabelText('Your name'), 'Sam')
    expect(join).toBeEnabled()
  })

  it('joins with a normalised code and connects', async () => {
    const user = userEvent.setup()
    renderJoinSession()

    await user.type(screen.getByLabelText('Session code'), 'k7f9q2')
    await user.type(screen.getByLabelText('Your name'), 'Sam Rivera')
    await user.click(screen.getByRole('button', { name: 'Join' }))

    expect(useConnectionStore.getState()).toMatchObject({
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
    renderJoinSession()
    await user.type(screen.getByLabelText('Session code'), 'K7F9Q2')
    await user.type(screen.getByLabelText('Your name'), 'Sam')

    act(() => useConnectionStore.setState({ connectionStatus: 'connecting' }))

    expect(screen.getByText('Connecting to peers…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Join' })).toBeDisabled()
  })

  it('shows the failure banner with a Retry action when disconnected', () => {
    useConnectionStore.setState({ connectionStatus: 'disconnected' })
    renderJoinSession()

    expect(screen.getByText(/Couldn.t reach the session/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  // #9: a participant's connectionStatus now stays 'connecting' until the
  // facilitator's own link is confirmed (#62), so a join that never reaches
  // the facilitator looks identical to one that's still in progress until the
  // same self-healing grace used for a mid-session drop rules out a blip.
  it('stays on the spinner for a connecting join within the grace window', () => {
    vi.useFakeTimers()
    try {
      renderJoinSession()
      fireEvent.change(screen.getByLabelText('Session code'), {
        target: { value: 'K7F9Q2' },
      })
      fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Sam' } })
      fireEvent.click(screen.getByRole('button', { name: 'Join' }))

      act(() => {
        vi.advanceTimersByTime(RECONNECT_GRACE_MS - 1)
      })

      expect(screen.getByText('Connecting to peers…')).toBeInTheDocument()
      expect(screen.queryByText(/Couldn.t reach the session/)).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('escalates to the failure banner once a connecting join outlives the grace window', () => {
    vi.useFakeTimers()
    try {
      renderJoinSession()
      fireEvent.change(screen.getByLabelText('Session code'), {
        target: { value: 'K7F9Q2' },
      })
      fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Sam' } })
      fireEvent.click(screen.getByRole('button', { name: 'Join' }))

      act(() => {
        vi.advanceTimersByTime(RECONNECT_GRACE_MS)
      })

      expect(screen.getByText(/Couldn.t reach the session/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled()
      expect(screen.queryByText('Connecting to peers…')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  // A retry tears down and rejoins while connectionStatus stays 'connecting'
  // throughout, so the failure banner must clear on the click itself rather
  // than staying latched at 'lost' until the connection actually succeeds.
  it('clears the failure banner immediately when Retry is clicked', () => {
    vi.useFakeTimers()
    try {
      renderJoinSession()
      fireEvent.change(screen.getByLabelText('Session code'), {
        target: { value: 'K7F9Q2' },
      })
      fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Sam' } })
      fireEvent.click(screen.getByRole('button', { name: 'Join' }))

      act(() => {
        vi.advanceTimersByTime(RECONNECT_GRACE_MS)
      })
      expect(screen.getByText(/Couldn.t reach the session/)).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

      expect(screen.queryByText(/Couldn.t reach the session/)).not.toBeInTheDocument()
      expect(screen.getByText('Connecting to peers…')).toBeInTheDocument()
      expect(connectMock).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('routes to the estimate view once this client has joined and is connected', async () => {
    const user = userEvent.setup()
    renderJoinSession()

    await user.type(screen.getByLabelText('Session code'), 'K7F9Q2')
    await user.type(screen.getByLabelText('Your name'), 'Sam')
    await user.click(screen.getByRole('button', { name: 'Join' }))
    expect(navigateMock).not.toHaveBeenCalled()

    act(() => useConnectionStore.setState({ connectionStatus: 'connected' }))

    expect(navigateMock).toHaveBeenCalledTimes(1)
    expect(navigateMock).toHaveBeenCalledWith('/estimate')
  })

  it('does not route away on mount from a stale connected status it did not initiate', () => {
    useConnectionStore.setState({ connectionStatus: 'connected' })
    renderJoinSession()

    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('Back disconnects and returns to mode-select', async () => {
    const user = userEvent.setup()
    renderJoinSession()

    await user.click(screen.getByRole('button', { name: '← Back' }))

    expect(disconnectMock).toHaveBeenCalled()
    expect(navigateMock).toHaveBeenCalledTimes(1)
    expect(navigateMock).toHaveBeenCalledWith('/')
  })
})
