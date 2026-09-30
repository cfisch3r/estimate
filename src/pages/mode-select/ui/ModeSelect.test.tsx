import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { ModeSelect } from './ModeSelect'
import { useSessionStore } from '../../../entities/session'

const { connectMock, navigateMock } = vi.hoisted(() => ({
  connectMock: vi.fn(),
  navigateMock: vi.fn(),
}))

vi.mock('../../../entities/session/api/sessionCode', () => ({
  generateSessionCode: () => 'LIVECODE',
}))
vi.mock('../../../entities/session/api/useNetworkSession', () => ({
  useNetworkSession: () => ({ connect: connectMock, disconnect: vi.fn() }),
}))
vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>()
  return { ...actual, useNavigate: () => navigateMock }
})

function renderModeSelect() {
  return render(
    <MemoryRouter>
      <ModeSelect />
    </MemoryRouter>,
  )
}

function resetStore() {
  useSessionStore.setState({
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
  navigateMock.mockClear()
})

describe('ModeSelect', () => {
  it('offers the three entry paths', () => {
    renderModeSelect()

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
    renderModeSelect()

    await user.click(screen.getByRole('button', { name: /Start single-user mode/ }))

    expect(useSessionStore.getState().mode).toBe('manual')
    expect(navigateMock).toHaveBeenCalledTimes(1)
    expect(navigateMock).toHaveBeenCalledWith('/workspace')
  })

  it('generates a code, enters live mode, and connects', async () => {
    const user = userEvent.setup()
    renderModeSelect()

    await user.click(
      screen.getByRole('button', { name: /Start collaborative estimation/ }),
    )

    const state = useSessionStore.getState()
    expect(state.mode).toBe('live')
    expect(state.sessionId).toBe('LIVECODE')
    expect(connectMock).toHaveBeenCalledWith('LIVECODE')
    expect(navigateMock).toHaveBeenCalledTimes(1)
    expect(navigateMock).toHaveBeenCalledWith('/workspace')
  })

  it('routes to the join screen', async () => {
    const user = userEvent.setup()
    renderModeSelect()

    await user.click(screen.getByRole('button', { name: /Join a collaborative session/ }))

    expect(navigateMock).toHaveBeenCalledTimes(1)
    expect(navigateMock).toHaveBeenCalledWith('/join')
  })

  it('activates a row with the keyboard', async () => {
    const user = userEvent.setup()
    renderModeSelect()

    screen.getByRole('button', { name: /Start single-user mode/ }).focus()
    await user.keyboard('{Enter}')

    expect(navigateMock).toHaveBeenCalledTimes(1)
    expect(navigateMock).toHaveBeenCalledWith('/workspace')
  })
})
