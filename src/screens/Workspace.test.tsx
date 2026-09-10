import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Workspace } from './Workspace'
import { createEstimate, type Estimate } from '../calc'
import { useSessionStore } from '../state/store'
import type { Item } from '../state/types'

const { sendRevealMock, sendRoundResetMock } = vi.hoisted(() => ({
  sendRevealMock: vi.fn(),
  sendRoundResetMock: vi.fn(),
}))

vi.mock('../network', () => ({
  useNetworkSession: () => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    sendEstimate: vi.fn(),
    sendReveal: sendRevealMock,
    sendRoundReset: sendRoundResetMock,
  }),
}))

function item(overrides: Partial<Item> = {}): Item {
  return {
    id: '1',
    title: 'Item',
    description: '',
    notes: '',
    finalResult: null,
    submissions: [],
    revealed: false,
    ...overrides,
  }
}

function estimate(participantId: string, best = 2, likely = 4, worst = 8): Estimate {
  const result = createEstimate({ participantId, best, likely, worst })
  if (!result.ok) throw new Error('bad fixture')
  return result.value
}

function resetStore() {
  useSessionStore.setState({
    currentScreen: 'workspace',
    sessionName: '',
    unit: 'days',
    items: [],
    activeItemId: null,
    mode: 'manual',
    role: 'facilitator',
    sessionId: null,
    connectionStatus: 'idle',
    peerCount: 0,
    participantNames: {},
  })
}

beforeEach(() => {
  sendRevealMock.mockClear()
  sendRoundResetMock.mockClear()
  resetStore()
})

describe('Workspace', () => {
  it('shows the empty state until an item is added, then the estimate widget', async () => {
    const user = userEvent.setup()
    render(<Workspace />)

    expect(screen.getByText('Add an item to get started')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('Add an item'), 'Retry queue')
    await user.click(screen.getByRole('button', { name: 'Add item' }))

    expect(screen.getByRole('heading', { name: 'Retry queue' })).toBeInTheDocument()
    expect(screen.queryByText('Add an item to get started')).not.toBeInTheDocument()
  })

  it('removes an item from the sidebar', async () => {
    const user = userEvent.setup()
    useSessionStore.setState({
      items: [item({ id: '1', title: 'Keep me' }), item({ id: '2', title: 'Remove me' })],
      activeItemId: '1',
    })
    render(<Workspace />)

    const row = screen.getByText('Remove me').closest('.session-sidebar-row')!
    await user.click(row.querySelector('button[aria-label="Remove item"]')!)

    expect(screen.queryByText('Remove me')).not.toBeInTheDocument()
    expect(useSessionStore.getState().items).toHaveLength(1)
  })

  it('falls back to the next pending item when the active one is removed', async () => {
    const user = userEvent.setup()
    useSessionStore.setState({
      items: [
        item({ id: '1', title: 'Active pending' }),
        item({ id: '2', title: 'Other pending' }),
      ],
      activeItemId: '1',
    })
    const { container } = render(<Workspace />)

    const rows = container.querySelectorAll('.session-sidebar-row')
    const activeRow = Array.from(rows).find((r) =>
      r.textContent?.includes('Active pending'),
    )!
    await user.click(activeRow.querySelector('button[aria-label="Remove item"]')!)

    expect(useSessionStore.getState().activeItemId).toBe('2')
    expect(screen.getByRole('heading', { name: 'Other pending' })).toBeInTheDocument()
  })

  it('distinguishes the empty, all-finalized, and nothing-selected panel states', () => {
    const finalized = { min: 1, expected: 2, max: 3, ci90: 3 }
    const { rerender } = render(<Workspace />)
    expect(screen.getByText('Add an item to get started')).toBeInTheDocument()

    useSessionStore.setState({
      items: [item({ id: '1', title: 'A', finalResult: finalized })],
      activeItemId: null,
    })
    rerender(<Workspace />)
    expect(screen.getByText('All items finalized')).toBeInTheDocument()

    useSessionStore.setState({
      items: [item({ id: '1', title: 'A' })],
      activeItemId: null,
    })
    rerender(<Workspace />)
    expect(screen.getByText('Select an item to estimate')).toBeInTheDocument()
  })

  it('renames the active item through the click-to-edit title', async () => {
    const user = userEvent.setup()
    useSessionStore.setState({
      items: [item({ id: '1', title: 'Typoo', description: 'desc' })],
      activeItemId: '1',
    })
    render(<Workspace />)

    await user.click(screen.getByRole('heading', { name: 'Typoo' }))
    const input = screen.getByLabelText('Item title')
    await user.clear(input)
    await user.type(input, 'Fixed title{Enter}')

    expect(useSessionStore.getState().items[0]!.title).toBe('Fixed title')
    expect(useSessionStore.getState().items[0]!.description).toBe('desc')
  })

  it('shows the live session-code strip in collaborative mode', () => {
    useSessionStore.setState({ mode: 'live', sessionId: 'K7F9Q2' })
    render(<Workspace />)

    expect(screen.getByText('K7F9Q2')).toBeInTheDocument()
    expect(screen.getByText('Waiting for participants…')).toBeInTheDocument()
  })
})

describe('Workspace — live facilitator reveal flow', () => {
  function setupRound(overrides: Partial<Item> = {}) {
    useSessionStore.setState({
      mode: 'live',
      role: 'facilitator',
      sessionId: 'K7F9Q2',
      connectionStatus: 'connected',
      peerCount: 2,
      participantNames: { facilitator: 'Facilitator', p1: 'Sam', p2: 'Alex' },
      items: [item({ id: 'i1', title: 'Retry queue', ...overrides })],
      activeItemId: 'i1',
    })
  }

  it('lists participants with waiting/submitted status and gates Reveal on a submission', () => {
    setupRound({ submissions: [estimate('p1')] })
    render(<Workspace />)

    expect(screen.getByText('Participants')).toBeInTheDocument()
    const sam = screen.getByText('Sam').closest('li')!
    const alex = screen.getByText('Alex').closest('li')!
    expect(sam).toHaveTextContent('Submitted')
    expect(alex).toHaveTextContent('Waiting')
    expect(screen.getByRole('button', { name: /Reveal estimates/ })).toBeEnabled()
  })

  it('disables Reveal while no estimates have been submitted', () => {
    setupRound()
    render(<Workspace />)

    expect(screen.getByRole('button', { name: 'Reveal estimates' })).toBeDisabled()
  })

  it('reveals the round: sets the flag, broadcasts, shows the aggregated bar and values', async () => {
    const user = userEvent.setup()
    setupRound({ submissions: [estimate('p1', 2, 4, 8), estimate('p2', 3, 5, 10)] })
    render(<Workspace />)

    await user.click(screen.getByRole('button', { name: /Reveal estimates/ }))

    expect(useSessionStore.getState().items[0]!.revealed).toBe(true)
    expect(sendRevealMock).toHaveBeenCalledWith('i1')
    expect(screen.getByText('Participant estimates')).toBeInTheDocument()
    expect(screen.getByText('2d / 4d / 8d')).toBeInTheDocument()
    expect(screen.getByText('best case')).toBeInTheDocument()
  })

  it('marks a non-responder "No response" after reveal', () => {
    setupRound({ revealed: true, submissions: [estimate('p1')] })
    render(<Workspace />)

    expect(screen.getByText('Alex').closest('li')!).toHaveTextContent('No response')
  })

  it('finalizes a revealed item by aggregating submissions', async () => {
    const user = userEvent.setup()
    setupRound({
      revealed: true,
      submissions: [estimate('p1', 2, 4, 8), estimate('p2', 4, 6, 12)],
    })
    render(<Workspace />)

    await user.click(screen.getByRole('button', { name: 'Finalize item' }))

    expect(useSessionStore.getState().items[0]!.finalResult).toEqual({
      min: 2,
      expected: 5,
      max: 12,
      ci90: expect.any(Number),
    })
  })

  it('retries a revealed round: clears submissions, broadcasts, returns to waiting', async () => {
    const user = userEvent.setup()
    setupRound({ revealed: true, submissions: [estimate('p1')] })
    render(<Workspace />)

    await user.click(screen.getByRole('button', { name: /Retry/ }))

    const stored = useSessionStore.getState().items[0]!
    expect(stored.revealed).toBe(false)
    expect(stored.submissions).toHaveLength(0)
    expect(sendRoundResetMock).toHaveBeenCalledWith('i1')
    expect(screen.getByText('Participants')).toBeInTheDocument()
  })

  it('leaves the manual estimate inputs in place for single-user mode', () => {
    useSessionStore.setState({
      mode: 'manual',
      items: [item({ id: 'i1', title: 'Solo' })],
      activeItemId: 'i1',
    })
    render(<Workspace />)

    expect(screen.getByLabelText(/Best case/)).toBeInTheDocument()
    expect(screen.queryByText('Participants')).not.toBeInTheDocument()
  })
})
