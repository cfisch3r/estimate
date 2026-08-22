import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SessionHistory } from './SessionHistory'
import { useSessionStore } from '../state/store'
import type { Item } from '../state/types'

function item(id: string, title: string, finalResult: Item['finalResult'] = null): Item {
  return { id, title, description: '', notes: '', finalResult }
}

const finalized = { min: 1, expected: 2, max: 3, ci90: 3 }

function resetStore() {
  useSessionStore.setState({
    currentScreen: 'create',
    sessionName: '',
    unit: 'days',
    items: [],
    activeItemId: null,
  })
}

beforeEach(resetStore)

describe('SessionHistory', () => {
  it('shows an empty state when there is no finalized session', () => {
    render(<SessionHistory />)

    expect(screen.getByText('No past sessions yet.')).toBeInTheDocument()
  })

  it('shows the current session once at least one item is finalized', () => {
    useSessionStore.setState({
      sessionName: 'Sprint 14',
      items: [item('1', 'A', finalized), item('2', 'B')],
      unit: 'days',
    })

    render(<SessionHistory />)

    expect(screen.getByText('Sprint 14 (current)')).toBeInTheDocument()
    expect(screen.getByText(/2 items · days/)).toBeInTheDocument()
    expect(screen.queryByText('No past sessions yet.')).not.toBeInTheDocument()
  })

  it('hides the current session when the search does not match its name', async () => {
    const user = userEvent.setup()
    useSessionStore.setState({
      sessionName: 'Sprint 14',
      items: [item('1', 'A', finalized)],
    })

    render(<SessionHistory />)
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

    render(<SessionHistory />)
    await user.click(screen.getByText('Sprint 14 (current)'))

    expect(useSessionStore.getState().currentScreen).toBe('summary')
  })
})
