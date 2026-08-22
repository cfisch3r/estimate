import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SessionSummary } from './SessionSummary'
import { useSessionStore } from '../state/store'
import type { Item } from '../state/types'

function item(id: string, title: string, finalResult: Item['finalResult'] = null): Item {
  return { id, title, description: '', notes: '', finalResult }
}

const finalized = { min: 2, expected: 5, max: 8, ci90: 8.85 }

function resetStore() {
  useSessionStore.setState({
    currentScreen: 'summary',
    sessionName: 'Sprint 14',
    unit: 'days',
    items: [],
    activeItemId: null,
  })
}

beforeEach(resetStore)

describe('SessionSummary', () => {
  it('lists only finalized items with their best/likely/worst values in a table', () => {
    useSessionStore.setState({
      items: [item('1', 'Migrate auth', finalized), item('2', 'Not done yet')],
    })

    render(<SessionSummary />)

    const table = screen.getByRole('table')
    const row = within(table).getByRole('row', { name: /Migrate auth/ })
    expect(within(row).getByText('2')).toBeInTheDocument()
    expect(within(row).getByText('5')).toBeInTheDocument()
    expect(within(row).getByText('8')).toBeInTheDocument()
    expect(within(table).queryByText('Not done yet')).not.toBeInTheDocument()
  })

  it('shows the shared sidebar alongside the table', () => {
    useSessionStore.setState({ items: [item('1', 'Migrate auth', finalized)] })

    render(<SessionSummary />)

    expect(screen.getByText('Items')).toBeInTheDocument()
  })

  it('returns to the previously active item when "Back to item" is clicked', async () => {
    const user = userEvent.setup()
    useSessionStore.setState({
      items: [item('1', 'Migrate auth', finalized)],
      activeItemId: '1',
    })

    render(<SessionSummary />)

    await user.click(screen.getByRole('button', { name: 'Back to item' }))

    expect(useSessionStore.getState().currentScreen).toBe('session')
    expect(useSessionStore.getState().activeItemId).toBe('1')
  })
})
