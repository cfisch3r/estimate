import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { MemoryRouter } from 'react-router'
import { ParticipantEstimateView } from './ParticipantEstimateView'
import { RECONNECT_GRACE_MS } from '../../../shared/lib/useConnectionPhase'
import { createEstimate, type Estimate } from '../../../entities/session'
import {
  useSessionStore,
  useConnectionStore,
  useRoundStore,
} from '../../../entities/session'

function mine(best: number, likely: number, worst: number): Estimate {
  const result = createEstimate({ participantId: 'me-123', best, likely, worst })
  if (!result.ok) throw new Error(result.error)
  return result.value
}

const { disconnectMock, sendEstimateMock, navigateMock } = vi.hoisted(() => ({
  disconnectMock: vi.fn(),
  sendEstimateMock: vi.fn(() => Promise.resolve()),
  navigateMock: vi.fn(),
}))

vi.mock('../../../entities/session/api/useNetworkSession', () => ({
  useNetworkSession: () => ({
    connect: vi.fn(),
    disconnect: disconnectMock,
    sendEstimate: sendEstimateMock,
  }),
}))
vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>()
  return { ...actual, useNavigate: () => navigateMock }
})

function renderView() {
  return render(
    <MemoryRouter>
      <ParticipantEstimateView />
    </MemoryRouter>,
  )
}

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
  navigateMock.mockClear()
  useSessionStore.setState({ unit: 'days' })
  useConnectionStore.setState({
    mode: 'live',
    role: 'participant',
    sessionId: 'K7F9Q2',
    myName: 'Sam',
    participantId: 'me-123',
    connectionStatus: 'connected',
    hasEverConnected: true,
    peerCount: 1,
    participantNames: {},
  })
  useRoundStore.setState({ liveRound: null })
})

describe('ParticipantEstimateView', () => {
  it('waits for the facilitator before a round starts', () => {
    renderView()

    expect(screen.getByText(/Waiting for the facilitator to start/)).toBeInTheDocument()
    expect(screen.getByText('Session K7F9Q2')).toBeInTheDocument()
  })

  // Trystero rebuilds a dropped link on its own within ~5-10s, so a fresh drop
  // must not raise the alarm — only one that outlives the grace window.
  it('stays quiet on a fresh drop, offering no reconnect action yet', () => {
    useConnectionStore.setState({ peerCount: 0 })
    renderView()

    expect(screen.getByText('Reconnecting…')).toBeInTheDocument()
    expect(screen.queryByText('Session connection lost')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reconnect' })).not.toBeInTheDocument()
  })

  it('surfaces the banner once the drop outlives the self-healing window', () => {
    vi.useFakeTimers()
    try {
      useConnectionStore.setState({ peerCount: 0 })
      renderView()

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
      useConnectionStore.setState({ peerCount: 0 })
      renderView()
      act(() => {
        vi.advanceTimersByTime(RECONNECT_GRACE_MS)
      })
      expect(screen.getByText('Session connection lost')).toBeInTheDocument()

      // Reconnect pressed: the tracker restarts at 'connecting' with no peers.
      act(() => {
        useConnectionStore.setState({ connectionStatus: 'connecting', peerCount: 0 })
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
    renderView()

    await user.click(screen.getByRole('button', { name: 'Leave session' }))

    expect(disconnectMock).toHaveBeenCalled()
    expect(navigateMock).toHaveBeenCalledTimes(1)
    expect(navigateMock).toHaveBeenCalledWith('/')
    expect(useConnectionStore.getState()).toMatchObject({
      mode: 'manual',
      sessionId: null,
    })
  })

  it('shows the estimating form for the active item, gated on a valid range', async () => {
    const user = userEvent.setup()
    useRoundStore.setState({
      liveRound: {
        item,
        submissions: [],
        revealed: false,
        round: 0,
        roster: [{ participantId: 'me-123', submitted: false, connected: true }],
        mySubmission: null,
      },
    })
    renderView()

    expect(screen.getByText('Retry queue')).toBeInTheDocument()
    expect(screen.getByText('exponential backoff')).toBeInTheDocument()
    // A roster of just this participant (facilitator excluded, self included).
    expect(screen.getByText('0 of 1 teammate have submitted so far.')).toBeInTheDocument()

    const submit = screen.getByRole('button', { name: 'Submit estimate' })
    expect(submit).toBeDisabled()

    // Partial, out-of-order entry gets the ascending nudge.
    await user.type(screen.getByLabelText('Best case (days)'), '10')
    await user.type(screen.getByLabelText('Most likely (days)'), '5')
    expect(await screen.findByText('Out of order')).toBeInTheDocument()
    expect(
      screen.getByText(/Best case \(10 days\) is higher than Most likely \(5 days\)/),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Best case (days)')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    expect(submit).toBeDisabled()

    // Completing the range with a descending worst is a hard validation failure.
    await user.type(screen.getByLabelText('Worst case (days)'), '3')
    expect(
      screen.getByText(/Best case \(10 days\) is higher than Most likely \(5 days\)/),
    ).toBeInTheDocument()
    expect(submit).toBeDisabled()
  })

  it('resets the Phase Picker selection when the round advances to a different item (guards the existing key={round.item.id} against a future regression)', async () => {
    const user = userEvent.setup()
    const itemB = { id: 'item-2', title: 'Second item', description: '' }
    useRoundStore.setState({
      liveRound: {
        item,
        submissions: [],
        revealed: false,
        round: 0,
        roster: [{ participantId: 'me-123', submitted: false, connected: true }],
        mySubmission: null,
      },
    })
    const { rerender } = renderView()

    expect(screen.getByText('Requirements Complete')).toHaveClass(
      'phase-picker-label--active',
    )
    await user.click(screen.getByLabelText('Next phase'))
    expect(screen.getByText('UI Complete')).toHaveClass('phase-picker-label--active')

    act(() => {
      useRoundStore.setState({
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
    rerender(
      <MemoryRouter>
        <ParticipantEstimateView />
      </MemoryRouter>,
    )

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
    useRoundStore.setState({
      liveRound: {
        item,
        submissions: [],
        revealed: false,
        round: 0,
        roster: [{ participantId: 'me-123', submitted: false, connected: true }],
        mySubmission: null,
      },
    })
    renderView()

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
    expect(useRoundStore.getState().liveRound?.mySubmission).toMatchObject({
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
    useRoundStore.setState({
      liveRound: {
        item,
        submissions: [],
        revealed: false,
        round: 0,
        roster: [{ participantId: 'me-123', submitted: false, connected: true }],
        mySubmission: null,
      },
    })
    renderView()

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
    useRoundStore.setState({
      liveRound: {
        item,
        submissions: [],
        revealed: false,
        round: 0,
        roster: [{ participantId: 'me-123', submitted: false, connected: true }],
        mySubmission: null,
      },
    })
    renderView()

    await user.type(screen.getByLabelText('Best case (days)'), '3')
    await user.type(screen.getByLabelText('Most likely (days)'), '5')
    await user.type(screen.getByLabelText('Worst case (days)'), '8')
    await user.click(screen.getByRole('button', { name: 'Submit estimate' }))

    expect(await screen.findByText('Not delivered yet')).toBeInTheDocument()
  })

  it('clears the not-delivered warning once the roster confirms delivery (e.g. a background resend landed)', async () => {
    const user = userEvent.setup()
    sendEstimateMock.mockRejectedValueOnce(new Error('no ack'))
    useRoundStore.setState({
      liveRound: {
        item,
        submissions: [],
        revealed: false,
        round: 0,
        roster: [{ participantId: 'me-123', submitted: false, connected: true }],
        mySubmission: null,
      },
    })
    renderView()

    await user.type(screen.getByLabelText('Best case (days)'), '3')
    await user.type(screen.getByLabelText('Most likely (days)'), '5')
    await user.type(screen.getByLabelText('Worst case (days)'), '8')
    await user.click(screen.getByRole('button', { name: 'Submit estimate' }))
    expect(await screen.findByText('Not delivered yet')).toBeInTheDocument()

    // The roster is the actual convergence proof (ADR-003) — once it says
    // delivered, the warning clears even without another local send attempt.
    act(() => {
      useRoundStore.setState((state) => ({
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
    useRoundStore.setState({
      liveRound: {
        item,
        submissions: [],
        revealed: false,
        round: 0,
        roster: [{ participantId: 'me-123', submitted: false, connected: true }],
        mySubmission: null,
      },
    })
    renderView()

    await user.type(screen.getByLabelText('Best case (days)'), '3')
    await user.type(screen.getByLabelText('Most likely (days)'), '5')
    await user.type(screen.getByLabelText('Worst case (days)'), '8')
    await user.click(screen.getByRole('button', { name: 'Submit estimate' }))
    expect(await screen.findByText('Not delivered yet')).toBeInTheDocument()

    vi.useFakeTimers()
    try {
      act(() => {
        useConnectionStore.setState({ peerCount: 0 })
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
    useRoundStore.setState({
      liveRound: {
        item,
        submissions: [estimate({ participantId: 'me-123' })],
        revealed: false,
        round: 0,
        roster: [{ participantId: 'me-123', submitted: true, connected: true }],
        mySubmission: mine(2, 4, 8),
      },
    })
    renderView()

    await user.click(screen.getByRole('button', { name: 'Revise estimate' }))
    expect(screen.getByRole('button', { name: 'Update estimate' })).toBeInTheDocument()
  })

  it('shows the aggregated range and the participant list once revealed', () => {
    useRoundStore.setState({
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
        mySubmission: mine(3, 5, 8),
      },
    })
    renderView()

    expect(screen.getByTestId('range-bar-marker-expected')).toBeInTheDocument()
    expect(screen.getByText('You')).toBeInTheDocument()
    expect(screen.getByText('Teammate 1')).toBeInTheDocument()
    expect(
      screen.getByText(/Waiting for the facilitator to finalize/),
    ).toBeInTheDocument()
  })

  it('labels revealed rows with announced names, own row stays "You", unknowns fall back', () => {
    useConnectionStore.setState({
      participantNames: { 'me-123': 'Sam', p2: 'Jordan Lee' },
    })
    useRoundStore.setState({
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
        mySubmission: mine(3, 5, 8),
      },
    })
    renderView()

    expect(screen.getByText('You')).toBeInTheDocument()
    expect(screen.getByText('Jordan Lee')).toBeInTheDocument()
    expect(screen.queryByText('Sam')).not.toBeInTheDocument()
    // p2 is named, so p3 keeps its slot-2 number rather than sliding to "Teammate 1".
    expect(screen.getByText('Teammate 2')).toBeInTheDocument()
    expect(screen.queryByText('Teammate 1')).not.toBeInTheDocument()
  })

  it('does not crash when a submission participantId collides with an Object.prototype key', () => {
    useConnectionStore.setState({ participantNames: {} })
    useRoundStore.setState({
      liveRound: {
        item,
        submissions: [
          estimate({ participantId: 'me-123', best: 3, likely: 5, worst: 8 }),
          estimate({ participantId: 'toString', best: 2, likely: 6, worst: 12 }),
        ],
        revealed: true,
        round: 0,
        roster: [],
        mySubmission: mine(3, 5, 8),
      },
    })
    renderView()

    expect(screen.getByText('You')).toBeInTheDocument()
    expect(screen.getByText('Teammate 1')).toBeInTheDocument()
  })

  describe('accessibility', () => {
    const roster = [{ participantId: 'me-123', submitted: false, connected: true }]
    const estimating = {
      item,
      submissions: [],
      revealed: false,
      round: 0,
      roster,
      mySubmission: null,
    }
    const waiting = { ...estimating, mySubmission: mine(2, 4, 8) }
    const revealed = {
      ...waiting,
      revealed: true,
      submissions: [estimate({ participantId: 'me-123' })],
    }

    // color-contrast needs real layout jsdom doesn't provide; see ADR-008.
    const scan = (container: HTMLElement) =>
      axe(container, { rules: { 'color-contrast': { enabled: false } } })

    it.each([
      ['lobby', null],
      ['estimating', estimating],
      ['waiting', waiting],
      ['revealed', revealed],
    ])('has no axe violations in the %s state', async (_name, liveRound) => {
      useRoundStore.setState({ liveRound })
      const { container } = renderView()

      expect(await scan(container)).toHaveNoViolations()
    })

    it('moves focus to the new heading after submitting', async () => {
      const user = userEvent.setup()
      useRoundStore.setState({ liveRound: estimating })
      renderView()

      await user.type(screen.getByLabelText('Best case (days)'), '3')
      await user.type(screen.getByLabelText('Most likely (days)'), '5')
      await user.type(screen.getByLabelText('Worst case (days)'), '8')
      await user.click(screen.getByRole('button', { name: 'Submit estimate' }))

      expect(screen.getByRole('heading', { level: 1 })).toHaveFocus()
    })

    it('does not steal focus on first render', () => {
      useRoundStore.setState({ liveRound: estimating })
      renderView()

      expect(document.body).toHaveFocus()
    })

    it('moves focus to the heading when the facilitator reveals', () => {
      useRoundStore.setState({ liveRound: waiting })
      renderView()

      act(() => {
        useRoundStore.setState({ liveRound: revealed })
      })

      expect(screen.getByRole('heading', { level: 1 })).toHaveFocus()
      expect(screen.getByText('Estimates revealed.')).toBeInTheDocument()
    })

    it('hands focus to the first input when revising, and back to Revise after updating', async () => {
      const user = userEvent.setup()
      useRoundStore.setState({ liveRound: waiting })
      renderView()

      await user.click(screen.getByRole('button', { name: 'Revise estimate' }))
      expect(screen.getByLabelText('Best case (days)')).toHaveFocus()

      await user.click(screen.getByRole('button', { name: 'Update estimate' }))
      expect(screen.getByRole('button', { name: 'Revise estimate' })).toHaveFocus()
    })

    it('announces a failed delivery through a status region', async () => {
      const user = userEvent.setup()
      sendEstimateMock.mockRejectedValueOnce(new Error('no ack'))
      useRoundStore.setState({ liveRound: estimating })
      renderView()

      await user.type(screen.getByLabelText('Best case (days)'), '3')
      await user.type(screen.getByLabelText('Most likely (days)'), '5')
      await user.type(screen.getByLabelText('Worst case (days)'), '8')
      await user.click(screen.getByRole('button', { name: 'Submit estimate' }))

      const notDelivered = await screen.findByText('Not delivered yet')
      expect(notDelivered.closest('[role="status"]')).not.toBeNull()
    })

    it('announces the submitted count through a status region', () => {
      useRoundStore.setState({ liveRound: estimating })
      renderView()

      const line = screen.getByText(/submitted so far/)
      expect(line.closest('[role="status"]')).not.toBeNull()
    })

    it('announces reconnecting as status and a lost link as an alert', () => {
      vi.useFakeTimers()
      try {
        useConnectionStore.setState({ peerCount: 0 })
        renderView()
        expect(
          screen.getByText('Reconnecting…').closest('[role="status"]'),
        ).not.toBeNull()

        act(() => {
          vi.advanceTimersByTime(RECONNECT_GRACE_MS)
        })

        expect(
          screen.getByText('Session connection lost').closest('[role="alert"]'),
        ).not.toBeNull()
      } finally {
        vi.useRealTimers()
      }
    })

    it('says nothing about a submit that was already there when the screen opened', () => {
      useRoundStore.setState({ liveRound: waiting })
      renderView()

      expect(screen.queryByText('Estimate submitted.')).not.toBeInTheDocument()
    })

    it('announces the submit when the view changes to waiting', async () => {
      const user = userEvent.setup()
      useRoundStore.setState({ liveRound: estimating })
      renderView()

      await user.type(screen.getByLabelText('Best case (days)'), '3')
      await user.type(screen.getByLabelText('Most likely (days)'), '5')
      await user.type(screen.getByLabelText('Worst case (days)'), '8')
      await user.click(screen.getByRole('button', { name: 'Submit estimate' }))

      expect(screen.getByText('Estimate submitted.')).toBeInTheDocument()
    })

    it('announces a revised estimate even though the view stays the same', async () => {
      const user = userEvent.setup()
      useRoundStore.setState({ liveRound: waiting })
      renderView()

      await user.click(screen.getByRole('button', { name: 'Revise estimate' }))
      await user.click(screen.getByRole('button', { name: 'Update estimate' }))

      expect(screen.getByText('Estimate updated.')).toBeInTheDocument()
    })

    it('announces when the connection to the session is established', () => {
      useConnectionStore.setState({ connectionStatus: 'connecting' })
      renderView()

      act(() => {
        useConnectionStore.setState({ connectionStatus: 'connected' })
      })

      expect(
        screen.getByText(/Connected\. Waiting for the facilitator/),
      ).toBeInTheDocument()
    })
  })
})
