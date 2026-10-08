import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { SessionHistory } from './SessionHistory'
import { useSessionStore } from '../../../application'
import type { Item } from '../../../domain/types'

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }))

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>()
  return { ...actual, useNavigate: () => navigateMock }
})

function renderSessionHistory() {
  return render(
    <MemoryRouter>
      <SessionHistory />
    </MemoryRouter>,
  )
}

function item(id: string, title: string, finalResult: Item['finalResult'] = null): Item {
  return {
    id,
    title,
    description: '',
    notes: '',
    finalResult,
    submissions: [],
    revealed: false,
    round: 0,
  }
}

const finalized = { min: 1, expected: 2, max: 3, ci90: 3 }

function resetStore() {
  useSessionStore.setState({
    sessionName: '',
    unit: 'days',
    items: [],
    activeItemId: null,
  })
}

beforeEach(() => {
  navigateMock.mockClear()
  resetStore()
})

describe('SessionHistory', () => {
  it('shows an empty state when there is no finalized session', () => {
    renderSessionHistory()

    expect(screen.getByText('No past sessions yet.')).toBeInTheDocument()
  })

  it('shows the current session once at least one item is finalized', () => {
    useSessionStore.setState({
      sessionName: 'Sprint 14',
      items: [item('1', 'A', finalized), item('2', 'B')],
      unit: 'days',
    })

    renderSessionHistory()

    expect(screen.getByText('Sprint 14 (current)')).toBeInTheDocument()
    expect(screen.getByText(/2 items · days/)).toBeInTheDocument()
    expect(screen.queryByText('No past sessions yet.')).not.toBeInTheDocument()
  })

  it('falls back to "Untitled session" when no name was entered', () => {
    useSessionStore.setState({
      sessionName: '',
      items: [item('1', 'A', finalized)],
      unit: 'days',
    })

    renderSessionHistory()

    expect(screen.getByText('Untitled session (current)')).toBeInTheDocument()
  })

  it('hides the current session when the search does not match its name', async () => {
    const user = userEvent.setup()
    useSessionStore.setState({
      sessionName: 'Sprint 14',
      items: [item('1', 'A', finalized)],
    })

    renderSessionHistory()
    await user.type(screen.getByPlaceholderText('Search sessions'), 'nope')

    expect(screen.queryByText('Sprint 14 (current)')).not.toBeInTheDocument()
    expect(screen.getByText('No past sessions yet.')).toBeInTheDocument()
  })

  it('navigates to the summary screen when the current session card is clicked', async () => {
    const user = userEvent.setup()
    useSessionStore.setState({
      sessionName: 'Sprint 14',
      items: [item('1', 'A', finalized)],
    })

    renderSessionHistory()
    await user.click(screen.getByText('Sprint 14 (current)'))

    expect(navigateMock).toHaveBeenCalledTimes(1)
    expect(navigateMock).toHaveBeenCalledWith('/summary')
  })
})
