import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ModeSelect } from './ModeSelect'
import { useSessionStore } from '../state/store'

const connectMock = vi.fn()

vi.mock('../network', () => ({
  generateSessionCode: () => 'LIVECODE',
  useNetworkSession: () => ({ connect: connectMock, disconnect: vi.fn() }),
}))

function resetStore() {
  useSessionStore.setState({
    currentScreen: 'mode-select',
    mode: 'manual',
    role: 'facilitator',
    sessionId: null,
    connectionStatus: 'idle',
    peerCount: 0,
    items: [],
    activeItemId: null,
  })
}

beforeEach(() => {
  resetStore()
  connectMock.mockClear()
})

describe('ModeSelect', () => {
  it('offers the three entry paths', () => {
    render(<ModeSelect />)

    expect(
      screen.getByRole('button', { name: /Start single-user mode/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Start collaborative estimation/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Join a collaborative session/ }),
    ).toBeInTheDocument()
  })

  it('enters the single-user workspace', async () => {
    const user = userEvent.setup()
    render(<ModeSelect />)

    await user.click(screen.getByRole('button', { name: /Start single-user mode/ }))

    expect(useSessionStore.getState().currentScreen).toBe('workspace')
    expect(useSessionStore.getState().mode).toBe('manual')
  })

  it('generates a code, enters live mode, and connects', async () => {
    const user = userEvent.setup()
    render(<ModeSelect />)

    await user.click(
      screen.getByRole('button', { name: /Start collaborative estimation/ }),
    )

    const state = useSessionStore.getState()
    expect(state.currentScreen).toBe('workspace')
    expect(state.mode).toBe('live')
    expect(state.sessionId).toBe('LIVECODE')
    expect(connectMock).toHaveBeenCalledWith('LIVECODE')
  })

  it('routes to the join screen', async () => {
    const user = userEvent.setup()
    render(<ModeSelect />)

    await user.click(screen.getByRole('button', { name: /Join a collaborative session/ }))

    expect(useSessionStore.getState().currentScreen).toBe('join')
  })

  it('activates a row with the keyboard', async () => {
    const user = userEvent.setup()
    render(<ModeSelect />)

    screen.getByRole('button', { name: /Start single-user mode/ }).focus()
    await user.keyboard('{Enter}')

    expect(useSessionStore.getState().currentScreen).toBe('workspace')
  })
})
