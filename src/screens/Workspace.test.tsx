import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Workspace } from './Workspace'
import { useSessionStore } from '../state/store'

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
  })
}

beforeEach(resetStore)

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
      items: [
        { id: '1', title: 'Keep me', description: '', notes: '', finalResult: null },
        { id: '2', title: 'Remove me', description: '', notes: '', finalResult: null },
      ],
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
        {
          id: '1',
          title: 'Active pending',
          description: '',
          notes: '',
          finalResult: null,
        },
        {
          id: '2',
          title: 'Other pending',
          description: '',
          notes: '',
          finalResult: null,
        },
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
      items: [
        { id: '1', title: 'A', description: '', notes: '', finalResult: finalized },
      ],
      activeItemId: null,
    })
    rerender(<Workspace />)
    expect(screen.getByText('All items finalized')).toBeInTheDocument()

    useSessionStore.setState({
      items: [{ id: '1', title: 'A', description: '', notes: '', finalResult: null }],
      activeItemId: null,
    })
    rerender(<Workspace />)
    expect(screen.getByText('Select an item to estimate')).toBeInTheDocument()
  })

  it('renames the active item through the click-to-edit title', async () => {
    const user = userEvent.setup()
    useSessionStore.setState({
      items: [
        { id: '1', title: 'Typoo', description: 'desc', notes: '', finalResult: null },
      ],
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
