import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { useSessionStore } from './state/store'

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

describe('Mode B end-to-end flow', () => {
  it('creates a session, estimates an item, finalizes it, and shows it in the summary', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Session name'), 'Sprint 14 refinement')
    await user.type(screen.getByPlaceholderText('Add an item'), 'Migrate auth service')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(screen.getByText('Migrate auth service')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Create session' }))

    expect(
      screen.getByRole('heading', { name: 'Migrate auth service' }),
    ).toBeInTheDocument()

    await user.type(screen.getByLabelText('Best case (days)'), '2')
    await user.type(screen.getByLabelText('Most likely (days)'), '5')
    await user.type(screen.getByLabelText('Worst case (days)'), '8')

    await user.click(screen.getByRole('button', { name: 'Finalize item' }))

    // no active item remains, so the panel shows the all-finalized state
    expect(screen.getByText('All items finalized')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'View summary' }))
    // (the sidebar's persistent link — the redundant one in the empty-state panel was removed)

    const summaryCard = screen
      .getByRole('heading', { name: 'Migrate auth service' })
      .closest('div')!
    expect(
      within(summaryCard).getByText(/2–8 days · expected 5 · CI90/),
    ).toBeInTheDocument()
  })

  it('rejects an out-of-order estimate and does not finalize the item', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Session name'), 'Sprint 14 refinement')
    await user.type(screen.getByPlaceholderText('Add an item'), 'Only item')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.click(screen.getByRole('button', { name: 'Create session' }))

    await user.type(screen.getByLabelText('Best case (days)'), '10')
    await user.type(screen.getByLabelText('Most likely (days)'), '5')
    await user.type(screen.getByLabelText('Worst case (days)'), '3')

    await user.click(screen.getByRole('button', { name: 'Finalize item' }))

    expect(screen.getByText(/best must be/i)).toBeInTheDocument()
    // still on the same item, not advanced
    expect(screen.getByRole('heading', { name: 'Only item' })).toBeInTheDocument()
  })

  it('shows the symmetric-range nudge for a suspiciously even split', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Session name'), 'Sprint 14 refinement')
    await user.type(screen.getByPlaceholderText('Add an item'), 'Only item')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.click(screen.getByRole('button', { name: 'Create session' }))

    await user.type(screen.getByLabelText('Best case (days)'), '2')
    await user.type(screen.getByLabelText('Most likely (days)'), '5')
    await user.type(screen.getByLabelText('Worst case (days)'), '8')

    expect(screen.getByText(/range looks symmetric/i)).toBeInTheDocument()
  })
})
