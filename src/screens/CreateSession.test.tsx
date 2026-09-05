import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreateSession } from './CreateSession'
import { useSessionStore } from '../state/store'

const { connectMock } = vi.hoisted(() => ({ connectMock: vi.fn() }))

vi.mock('../network', () => ({
  generateSessionCode: () => 'TEST42',
  useNetworkSession: () => ({ connect: connectMock, disconnect: vi.fn() }),
}))

function resetStore() {
  useSessionStore.setState({
    currentScreen: 'create',
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

beforeEach(() => {
  connectMock.mockClear()
  resetStore()
})

async function fillNamedSession(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Session name'), 'Sprint 14')
  await user.type(screen.getByPlaceholderText('Add an item'), 'Auth service')
  await user.click(screen.getByRole('button', { name: 'Add' }))
}

describe('CreateSession mode selection', () => {
  it('defaults to manual entry', () => {
    render(<CreateSession />)
    expect(screen.getByRole('radio', { name: /Manual entry/ })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Create session' })).toBeInTheDocument()
  })

  it('creates a live session, generates a code, and connects', async () => {
    const user = userEvent.setup()
    render(<CreateSession />)

    await user.click(screen.getByRole('radio', { name: /Live collaborative/ }))
    await fillNamedSession(user)
    await user.click(screen.getByRole('button', { name: 'Create live session' }))

    expect(useSessionStore.getState()).toMatchObject({
      mode: 'live',
      role: 'facilitator',
      sessionId: 'TEST42',
      connectionStatus: 'connecting',
      currentScreen: 'session',
    })
    expect(connectMock).toHaveBeenCalledWith('TEST42')
  })

  it('routes to the join screen', async () => {
    const user = userEvent.setup()
    render(<CreateSession />)

    await user.click(screen.getByRole('button', { name: /Join a live session/ }))

    expect(useSessionStore.getState().currentScreen).toBe('join')
  })
})
