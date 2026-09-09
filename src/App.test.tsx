import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import App from './App'
import { useSessionStore } from './state/store'

vi.mock('./network', () => ({
  generateSessionCode: () => 'LIVECODE',
  NetworkProvider: ({ children }: { children: ReactNode }) => children,
  useNetworkSession: () => ({ connect: vi.fn(), disconnect: vi.fn() }),
}))

function resetStore() {
  useSessionStore.setState({
    currentScreen: 'mode-select',
    sessionName: '',
    unit: 'days',
    items: [],
    activeItemId: null,
    mode: 'manual',
    role: 'facilitator',
    sessionId: null,
    myName: '',
    connectionStatus: 'idle',
    peerCount: 0,
  })
}

beforeEach(resetStore)

/** Mode-select → single-user workspace, then add one item (which auto-selects,
 *  surfacing the estimate widget). */
async function startSingleUserWithItem(
  user: ReturnType<typeof userEvent.setup>,
  title: string,
) {
  await user.click(screen.getByRole('button', { name: /Start single-user mode/ }))
  await user.type(screen.getByPlaceholderText('Add an item'), title)
  await user.click(screen.getByRole('button', { name: 'Add item' }))
}

describe('Single-user end-to-end flow', () => {
  it('enters the workspace, estimates an item, finalizes it, and shows it in the summary', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Start single-user mode/ }))

    // empty state until an item exists
    expect(screen.getByText('Add an item to get started')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('Add an item'), 'Migrate auth service')
    await user.click(screen.getByRole('button', { name: 'Add item' }))

    expect(
      screen.getByRole('heading', { name: 'Migrate auth service' }),
    ).toBeInTheDocument()

    await user.type(screen.getByLabelText('Best case (days)'), '2')
    await user.type(screen.getByLabelText('Most likely (days)'), '5')
    await user.type(screen.getByLabelText('Worst case (days)'), '8')

    await user.click(screen.getByRole('button', { name: 'Finalize item' }))

    // the single item is finalized, so no item stays active
    expect(screen.getByText('All items finalized')).toBeInTheDocument()

    await user.click(screen.getByText('Summary'))

    const table = screen.getByRole('table')
    const row = within(table).getByRole('row', { name: /Migrate auth service/ })
    expect(within(row).getByText('2')).toBeInTheDocument()
    expect(within(row).getByText('5')).toBeInTheDocument()
    expect(within(row).getByText('8')).toBeInTheDocument()
  })

  it('shows the ordering warning live while typing, before Finalize is clicked, and disables Finalize', async () => {
    const user = userEvent.setup()
    render(<App />)

    await startSingleUserWithItem(user, 'Only item')

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

    await startSingleUserWithItem(user, 'Only item')

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

    await startSingleUserWithItem(user, 'Only item')

    expect(screen.getByLabelText('Best case (days)')).toHaveAttribute('min', '0')
    expect(screen.getByLabelText('Most likely (days)')).toHaveAttribute('min', '0')
    expect(screen.getByLabelText('Worst case (days)')).toHaveAttribute('min', '0')
  })

  it('shows the symmetric-range nudge for a suspiciously even split', async () => {
    const user = userEvent.setup()
    render(<App />)

    await startSingleUserWithItem(user, 'Only item')

    await user.type(screen.getByLabelText('Best case (days)'), '2')
    await user.type(screen.getByLabelText('Most likely (days)'), '5')
    await user.type(screen.getByLabelText('Worst case (days)'), '8')

    expect(screen.getByText('Symmetric range')).toBeInTheDocument()
  })
})

describe('Mode selection routing', () => {
  it('starts a live session and surfaces the shareable code on the workspace', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(
      screen.getByRole('button', { name: /Start collaborative estimation/ }),
    )

    expect(screen.getByText('LIVECODE')).toBeInTheDocument()
    expect(screen.getByText('Waiting for participants…')).toBeInTheDocument()
    expect(screen.getByText('Live')).toBeInTheDocument()
  })

  it('navigates to the join screen and back to mode selection', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Join a collaborative session/ }))
    expect(
      screen.getByRole('heading', { name: 'Join a live session' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '← Back' }))
    expect(
      screen.getByRole('button', { name: /Start single-user mode/ }),
    ).toBeInTheDocument()
  })
})
