import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { SessionSummary } from './SessionSummary'
import { useSessionStore } from '../../../application'
import type { Item } from '../../../domain/types'

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }))

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>()
  return { ...actual, useNavigate: () => navigateMock }
})

function renderSessionSummary() {
  return render(
    <MemoryRouter initialEntries={['/summary']}>
      <SessionSummary />
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

const finalized = { min: 2, expected: 5, max: 8, ci90: 8.85 }

function resetStore() {
  useSessionStore.setState({
    sessionName: 'Sprint 14',
    unit: 'days',
    items: [],
    activeItemId: null,
  })
}

beforeEach(() => {
  navigateMock.mockClear()
  resetStore()
})

describe('SessionSummary', () => {
  it('lists only finalized items with their best/likely/worst values in a table', () => {
    useSessionStore.setState({
      items: [item('1', 'Migrate auth', finalized), item('2', 'Not done yet')],
    })

    renderSessionSummary()

    const table = screen.getByRole('table')
    const row = within(table).getByRole('row', { name: /Migrate auth/ })
    expect(within(row).getByText('2')).toBeInTheDocument()
    expect(within(row).getByText('5')).toBeInTheDocument()
    expect(within(row).getByText('8')).toBeInTheDocument()
    expect(within(table).queryByText('Not done yet')).not.toBeInTheDocument()
  })

  it('shows the shared sidebar alongside the table', () => {
    useSessionStore.setState({ items: [item('1', 'Migrate auth', finalized)] })

    renderSessionSummary()

    expect(screen.getByText('Items')).toBeInTheDocument()
  })

  it('returns to the previously active item when "Back to item" is clicked', async () => {
    const user = userEvent.setup()
    useSessionStore.setState({
      items: [item('1', 'Migrate auth', finalized)],
      activeItemId: '1',
    })

    renderSessionSummary()

    await user.click(screen.getByRole('button', { name: 'Back to item' }))

    expect(navigateMock).toHaveBeenCalledTimes(1)
    expect(navigateMock).toHaveBeenCalledWith('/workspace')
    expect(useSessionStore.getState().activeItemId).toBe('1')
  })
})
