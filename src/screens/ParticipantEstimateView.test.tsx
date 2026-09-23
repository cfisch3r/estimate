import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ParticipantEstimateView } from './ParticipantEstimateView'
import { RECONNECT_GRACE_MS } from './useConnectionPhase'
import { createEstimate, type Estimate } from '../calc'
import { useSessionStore } from '../state/store'

const { disconnectMock, sendEstimateMock } = vi.hoisted(() => ({
  disconnectMock: vi.fn(),
  sendEstimateMock: vi.fn(() => Promise.resolve()),
}))

vi.mock('../network', () => ({
  useNetworkSession: () => ({
    connect: vi.fn(),
    disconnect: disconnectMock,
    sendEstimate: sendEstimateMock,
  }),
}))

const item = { id: 'item-1', title: 'Retry queue', description: 'exponential backoff' }

function estimate(overrides: Partial<Estimate> = {}): Estimate {
  const result = createEstimate({
    participantId: 'p1',
    best: 2,
    likely: 4,
    worst: 8,
    ...overrides,
  })
  if (!result.ok) throw new Error('bad fixture')
  return result.value
}

beforeEach(() => {
  disconnectMock.mockClear()
  sendEstimateMock.mockClear()
  useSessionStore.setState({
    currentScreen: 'estimate',
    unit: 'days',
    mode: 'live',
    role: 'participant',
    sessionId: 'K7F9Q2',
    myName: 'Sam',
    participantId: 'me-123',
    connectionStatus: 'connected',
    hasEverConnected: true,
    peerCount: 1,
    liveRound: null,
    participantNames: {},
  })
})

describe('ParticipantEstimateView', () => {
  it('waits for the facilitator before a round starts', () => {
    render(<ParticipantEstimateView />)

    expect(screen.getByText(/Waiting for the facilitator to start/)).toBeInTheDocument()
    expect(screen.getByText('Session K7F9Q2')).toBeInTheDocument()
  })

  // Trystero rebuilds a dropped link on its own within ~5-10s, so a fresh drop
  // must not raise the alarm — only one that outlives the grace window.
  it('stays quiet on a fresh drop, offering no reconnect action yet', () => {
    useSessionStore.setState({ peerCount: 0 })
    render(<ParticipantEstimateView />)

    expect(screen.getByText('Reconnecting…')).toBeInTheDocument()
    expect(screen.queryByText('Session connection lost')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reconnect' })).not.toBeInTheDocument()
  })

  it('surfaces the banner once the drop outlives the self-healing window', () => {
    vi.useFakeTimers()
    try {
      useSessionStore.setState({ peerCount: 0 })
      render(<ParticipantEstimateView />)

      act(() => {
        vi.advanceTimersByTime(RECONNECT_GRACE_MS)
      })

      expect(screen.getByText('Session connection lost')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Reconnect' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Leave session' })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  // Regression: `connect()` builds a fresh connection tracker, so a reconnect
  // resets connectionStatus to 'connecting'. Keying the alarm off status alone
  // made the banner vanish the moment Reconnect was pressed, leaving a failed
  // rejoin looking like a healthy session that silently swallows estimates.
  it('keeps warning when a manual reconnect fails to find anyone', () => {
    vi.useFakeTimers()
    try {
      useSessionStore.setState({ peerCount: 0 })
      render(<ParticipantEstimateView />)
      act(() => {
        vi.advanceTimersByTime(RECONNECT_GRACE_MS)
      })
      expect(screen.getByText('Session connection lost')).toBeInTheDocument()

      // Reconnect pressed: the tracker restarts at 'connecting' with no peers.
      act(() => {
        useSessionStore.setState({ connectionStatus: 'connecting', peerCount: 0 })
      })
      act(() => {
        vi.advanceTimersByTime(RECONNECT_GRACE_MS)
      })

      expect(screen.getByText('Session connection lost')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Reconnect' })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('leaves the session and returns to mode selection', async () => {
    const user = userEvent.setup()
    render(<ParticipantEstimateView />)

    await user.click(screen.getByRole('button', { name: 'Leave session' }))

    expect(disconnectMock).toHaveBeenCalled()
    expect(useSessionStore.getState()).toMatchObject({
      currentScreen: 'mode-select',
      mode: 'manual',
      sessionId: null,
    })
  })

  it('shows the estimating form for the active item, gated on a valid range', async () => {
    const user = userEvent.setup()
    useSessionStore.setState({
      liveRound: {
        item,
        submissions: [],
        revealed: false,
        round: 0,
        roster: [{ participantId: 'me-123', submitted: false, connected: true }],
        mySubmission: null,
      },
    })
    render(<ParticipantEstimateView />)

    expect(screen.getByText('Retry queue')).toBeInTheDocument()
    expect(screen.getByText('exponential backoff')).toBeInTheDocument()
    // A roster of just this participant (facilitator excluded, self included).
    expect(screen.getByText('0 of 1 teammate have submitted so far.')).toBeInTheDocument()

    const submit = screen.getByRole('button', { name: 'Submit estimate' })
    expect(submit).toBeDisabled()

    // Partial, out-of-order entry gets the ascending nudge.
    await user.type(screen.getByLabelText('Best case (days)'), '10')
    await user.type(screen.getByLabelText('Most likely (days)'), '5')
    expect(screen.getByText('Out of order')).toBeInTheDocument()
    expect(submit).toBeDisabled()

    // Completing the range with a descending worst is a hard validation failure.
    await user.type(screen.getByLabelText('Worst case (days)'), '3')
    expect(screen.getByText('Check your estimate')).toBeInTheDocument()
    expect(submit).toBeDisabled()
  })

  it('resets the Phase Picker selection when the round advances to a different item (guards the existing key={round.item.id} against a future regression)', async () => {
    const user = userEvent.setup()
    const itemB = { id: 'item-2', title: 'Second item', description: '' }
    useSessionStore.setState({
      liveRound: {
        item,
        submissions: [],
        revealed: false,
        round: 0,
        roster: [{ participantId: 'me-123', submitted: false, connected: true }],
        mySubmission: null,
      },
    })
    const { rerender } = render(<ParticipantEstimateView />)

    expect(screen.getByText('Requirements Complete')).toHaveClass(
      'phase-picker-label--active',
    )
    await user.click(screen.getByLabelText('Next phase'))
    expect(screen.getByText('UI Complete')).toHaveClass('phase-picker-label--active')

    act(() => {
      useSessionStore.setState({
        liveRound: {
          item: itemB,
          submissions: [],
          revealed: false,
          round: 0,
          roster: [{ participantId: 'me-123', submitted: false, connected: true }],
          mySubmission: null,
        },
      })
    })
    rerender(<ParticipantEstimateView />)

    expect(screen.getByText('Second item')).toBeInTheDocument()
    expect(screen.getByText('Requirements Complete')).toHaveClass(
      'phase-picker-label--active',
    )
    expect(screen.queryByText('UI Complete')).not.toHaveClass(
      'phase-picker-label--active',
    )
  })

  it('submits a valid estimate, broadcasts it, and moves to the waiting state', async () => {
    const user = userEvent.setup()
    useSessionStore.setState({
      liveRound: {
        item,
        submissions: [],
        revealed: false,
        round: 0,
        roster: [{ participantId: 'me-123', submitted: false, connected: true }],
        mySubmission: null,
      },
    })
    render(<ParticipantEstimateView />)

    await user.type(screen.getByLabelText('Best case (days)'), '3')
    await user.type(screen.getByLabelText('Most likely (days)'), '5')
    await user.type(screen.getByLabelText('Worst case (days)'), '8')
    await user.click(screen.getByRole('button', { name: 'Submit estimate' }))

    expect(sendEstimateMock).toHaveBeenCalledWith(
      'item-1',
      expect.objectContaining({ participantId: 'me-123', best: 3, likely: 5, worst: 8 }),
      0,
    )
    expect(screen.getByText(/Waiting for the facilitator to reveal/)).toBeInTheDocument()
    expect(useSessionStore.getState().liveRound?.mySubmission).toEqual({
      best: 3,
      likely: 5,
      worst: 8,
    })
  })

  it('shows a sending indicator while the estimate delivery is still in flight', async () => {
    const user = userEvent.setup()
    let resolveSend: (() => void) | null = null
    sendEstimateMock.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveSend = resolve
        }),
    )
    useSessionStore.setState({
      liveRound: {
        item,
        submissions: [],
        revealed: false,
        round: 0,
        roster: [{ participantId: 'me-123', submitted: false, connected: true }],
        mySubmission: null,
      },
    })
    render(<ParticipantEstimateView />)

    await user.type(screen.getByLabelText('Best case (days)'), '3')
    await user.type(screen.getByLabelText('Most likely (days)'), '5')
    await user.type(screen.getByLabelText('Worst case (days)'), '8')
    await user.click(screen.getByRole('button', { name: 'Submit estimate' }))

    expect(screen.getByText('Sending your estimate…')).toBeInTheDocument()
    expect(screen.queryByText('Not delivered yet')).not.toBeInTheDocument()

    await act(async () => {
      resolveSend?.()
      await Promise.resolve()
    })
  })

  it('shows a not-delivered warning once the send fails and the roster still disagrees', async () => {
    const user = userEvent.setup()
    sendEstimateMock.mockRejectedValueOnce(new Error('no ack'))
    useSessionStore.setState({
      liveRound: {
        item,
        submissions: [],
        revealed: false,
        round: 0,
        roster: [{ participantId: 'me-123', submitted: false, connected: true }],
        mySubmission: null,
      },
    })
    render(<ParticipantEstimateView />)

    await user.type(screen.getByLabelText('Best case (days)'), '3')
    await user.type(screen.getByLabelText('Most likely (days)'), '5')
    await user.type(screen.getByLabelText('Worst case (days)'), '8')
    await user.click(screen.getByRole('button', { name: 'Submit estimate' }))

    expect(await screen.findByText('Not delivered yet')).toBeInTheDocument()
  })

  it('clears the not-delivered warning once the roster confirms delivery (e.g. a background resend landed)', async () => {
    const user = userEvent.setup()
    sendEstimateMock.mockRejectedValueOnce(new Error('no ack'))
    useSessionStore.setState({
      liveRound: {
        item,
        submissions: [],
        revealed: false,
        round: 0,
        roster: [{ participantId: 'me-123', submitted: false, connected: true }],
        mySubmission: null,
      },
    })
    render(<ParticipantEstimateView />)

    await user.type(screen.getByLabelText('Best case (days)'), '3')
    await user.type(screen.getByLabelText('Most likely (days)'), '5')
    await user.type(screen.getByLabelText('Worst case (days)'), '8')
    await user.click(screen.getByRole('button', { name: 'Submit estimate' }))
    expect(await screen.findByText('Not delivered yet')).toBeInTheDocument()

    // The roster is the actual convergence proof (ADR-003) — once it says
    // delivered, the warning clears even without another local send attempt.
    act(() => {
      useSessionStore.setState((state) => ({
        liveRound: state.liveRound && {
          ...state.liveRound,
          roster: [{ participantId: 'me-123', submitted: true, connected: true }],
        },
      }))
    })

    expect(screen.queryByText('Not delivered yet')).not.toBeInTheDocument()
  })

  it('defers to the connection-lost banner instead of stacking a not-delivered warning', async () => {
    const user = userEvent.setup()
    sendEstimateMock.mockRejectedValueOnce(new Error('no ack'))
    useSessionStore.setState({
      liveRound: {
        item,
        submissions: [],
        revealed: false,
        round: 0,
        roster: [{ participantId: 'me-123', submitted: false, connected: true }],
        mySubmission: null,
      },
    })
    render(<ParticipantEstimateView />)

    await user.type(screen.getByLabelText('Best case (days)'), '3')
    await user.type(screen.getByLabelText('Most likely (days)'), '5')
    await user.type(screen.getByLabelText('Worst case (days)'), '8')
    await user.click(screen.getByRole('button', { name: 'Submit estimate' }))
    expect(await screen.findByText('Not delivered yet')).toBeInTheDocument()

    vi.useFakeTimers()
    try {
      act(() => {
        useSessionStore.setState({ peerCount: 0 })
      })
      act(() => {
        vi.advanceTimersByTime(RECONNECT_GRACE_MS)
      })

      expect(screen.getByText('Session connection lost')).toBeInTheDocument()
      expect(screen.queryByText('Not delivered yet')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('lets the participant revise a submission before the reveal', async () => {
    const user = userEvent.setup()
    useSessionStore.setState({
      liveRound: {
        item,
        submissions: [estimate({ participantId: 'me-123' })],
        revealed: false,
        round: 0,
        roster: [{ participantId: 'me-123', submitted: true, connected: true }],
        mySubmission: { best: 2, likely: 4, worst: 8 },
      },
    })
    render(<ParticipantEstimateView />)

    await user.click(screen.getByRole('button', { name: 'Revise estimate' }))
    expect(screen.getByRole('button', { name: 'Update estimate' })).toBeInTheDocument()
  })

  it('shows the aggregated range and the participant list once revealed', () => {
    useSessionStore.setState({
      liveRound: {
        item,
        submissions: [
          estimate({ participantId: 'me-123', best: 3, likely: 5, worst: 8 }),
          estimate({ participantId: 'p2', best: 2, likely: 6, worst: 12 }),
        ],
        revealed: true,
        round: 0,
        roster: [
          { participantId: 'me-123', submitted: true, connected: true },
          { participantId: 'p2', submitted: true, connected: true },
        ],
        mySubmission: { best: 3, likely: 5, worst: 8 },
      },
    })
    render(<ParticipantEstimateView />)

    expect(screen.getByTestId('range-bar-marker-expected')).toBeInTheDocument()
    expect(screen.getByText('You')).toBeInTheDocument()
    expect(screen.getByText('Teammate 1')).toBeInTheDocument()
    expect(
      screen.getByText(/Waiting for the facilitator to finalize/),
    ).toBeInTheDocument()
  })

  it('labels revealed rows with announced names, own row stays "You", unknowns fall back', () => {
    useSessionStore.setState({
      participantNames: { 'me-123': 'Sam', p2: 'Jordan Lee' },
      liveRound: {
        item,
        submissions: [
          estimate({ participantId: 'me-123', best: 3, likely: 5, worst: 8 }),
          estimate({ participantId: 'p2', best: 2, likely: 6, worst: 12 }),
          estimate({ participantId: 'p3', best: 1, likely: 4, worst: 9 }),
        ],
        revealed: true,
        round: 0,
        roster: [],
        mySubmission: { best: 3, likely: 5, worst: 8 },
      },
    })
    render(<ParticipantEstimateView />)

    expect(screen.getByText('You')).toBeInTheDocument()
    expect(screen.getByText('Jordan Lee')).toBeInTheDocument()
    expect(screen.queryByText('Sam')).not.toBeInTheDocument()
    // p2 is named, so p3 keeps its slot-2 number rather than sliding to "Teammate 1".
    expect(screen.getByText('Teammate 2')).toBeInTheDocument()
    expect(screen.queryByText('Teammate 1')).not.toBeInTheDocument()
  })

  it('does not crash when a submission participantId collides with an Object.prototype key', () => {
    useSessionStore.setState({
      participantNames: {},
      liveRound: {
        item,
        submissions: [
          estimate({ participantId: 'me-123', best: 3, likely: 5, worst: 8 }),
          estimate({ participantId: 'toString', best: 2, likely: 6, worst: 12 }),
        ],
        revealed: true,
        round: 0,
        roster: [],
        mySubmission: { best: 3, likely: 5, worst: 8 },
      },
    })
    render(<ParticipantEstimateView />)

    expect(screen.getByText('You')).toBeInTheDocument()
    expect(screen.getByText('Teammate 1')).toBeInTheDocument()
  })
})
