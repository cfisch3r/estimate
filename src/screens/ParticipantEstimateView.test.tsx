import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ParticipantEstimateView } from './ParticipantEstimateView'
import { createEstimate, type Estimate } from '../calc'
import { useSessionStore } from '../state/store'

const { disconnectMock, sendEstimateMock } = vi.hoisted(() => ({
  disconnectMock: vi.fn(),
  sendEstimateMock: vi.fn(),
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

  it('surfaces a banner when the connection is lost', () => {
    useSessionStore.setState({ connectionStatus: 'disconnected' })
    render(<ParticipantEstimateView />)

    expect(screen.getByText('Session connection lost')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Leave session' })).toBeInTheDocument()
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
      liveRound: { item, submissions: [], revealed: false, mySubmission: null },
    })
    render(<ParticipantEstimateView />)

    expect(screen.getByText('Retry queue')).toBeInTheDocument()
    expect(screen.getByText('exponential backoff')).toBeInTheDocument()
    // peerCount 1 = just this participant (facilitator excluded, self included).
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

  it('submits a valid estimate, broadcasts it, and moves to the waiting state', async () => {
    const user = userEvent.setup()
    useSessionStore.setState({
      liveRound: { item, submissions: [], revealed: false, mySubmission: null },
    })
    render(<ParticipantEstimateView />)

    await user.type(screen.getByLabelText('Best case (days)'), '3')
    await user.type(screen.getByLabelText('Most likely (days)'), '5')
    await user.type(screen.getByLabelText('Worst case (days)'), '8')
    await user.click(screen.getByRole('button', { name: 'Submit estimate' }))

    expect(sendEstimateMock).toHaveBeenCalledWith(
      expect.objectContaining({ participantId: 'me-123', best: 3, likely: 5, worst: 8 }),
    )
    expect(screen.getByText(/Waiting for the facilitator to reveal/)).toBeInTheDocument()
    expect(useSessionStore.getState().liveRound?.mySubmission).toEqual({
      best: 3,
      likely: 5,
      worst: 8,
    })
  })

  it('lets the participant revise a submission before the reveal', async () => {
    const user = userEvent.setup()
    useSessionStore.setState({
      liveRound: {
        item,
        submissions: [estimate({ participantId: 'me-123' })],
        revealed: false,
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
        mySubmission: { best: 3, likely: 5, worst: 8 },
      },
    })
    render(<ParticipantEstimateView />)

    expect(screen.getByText('You')).toBeInTheDocument()
    expect(screen.getByText('Teammate 1')).toBeInTheDocument()
  })
})
