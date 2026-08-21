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
      .closest<HTMLElement>('.card')!
    expect(within(summaryCard).getByText('2d best')).toBeInTheDocument()
    expect(within(summaryCard).getByText('8d worst')).toBeInTheDocument()
    expect(within(summaryCard).getByText('5d')).toBeInTheDocument()
  })

  it('shows the ordering warning live while typing, before Finalize is clicked, and disables Finalize', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Session name'), 'Sprint 14 refinement')
    await user.type(screen.getByPlaceholderText('Add an item'), 'Only item')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.click(screen.getByRole('button', { name: 'Create session' }))

    await user.type(screen.getByLabelText('Best case (days)'), '2')
    await user.type(screen.getByLabelText('Most likely (days)'), '5')
    await user.type(screen.getByLabelText('Worst case (days)'), '3')

    expect(screen.getByText(/best must be/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Finalize item' })).toBeDisabled()
    // still on the same item, not advanced
    expect(screen.getByRole('heading', { name: 'Only item' })).toBeInTheDocument()
  })

  it('clears the ordering warning and re-enables Finalize once the values are edited back into range', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Session name'), 'Sprint 14 refinement')
    await user.type(screen.getByPlaceholderText('Add an item'), 'Only item')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.click(screen.getByRole('button', { name: 'Create session' }))

    await user.type(screen.getByLabelText('Best case (days)'), '2')
    await user.type(screen.getByLabelText('Most likely (days)'), '5')
    await user.type(screen.getByLabelText('Worst case (days)'), '3')
    expect(screen.getByText(/best must be/i)).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Worst case (days)'))
    await user.type(screen.getByLabelText('Worst case (days)'), '15')

    expect(screen.queryByText(/best must be/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Finalize item' })).toBeEnabled()
  })

  it('keeps the estimate inputs from stepping below zero via the spinner arrows', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Session name'), 'Sprint 14 refinement')
    await user.type(screen.getByPlaceholderText('Add an item'), 'Only item')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.click(screen.getByRole('button', { name: 'Create session' }))

    expect(screen.getByLabelText('Best case (days)')).toHaveAttribute('min', '0')
    expect(screen.getByLabelText('Most likely (days)')).toHaveAttribute('min', '0')
    expect(screen.getByLabelText('Worst case (days)')).toHaveAttribute('min', '0')
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
