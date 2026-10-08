import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import {
  useConnectionStore,
  useRoundStore,
  useSessionStore,
} from '../../../entities/session'
import { ROUTES } from '../../../shared/lib/routes'
import { useLeaveLiveSession } from './useLeaveLiveSession'
import { useLeaveWorkspace } from './useLeaveWorkspace'
import { useReconnect } from '../../../application/useCases/useReconnect'
import { useStartCollaborative } from './useStartCollaborative'
import { useStartSingleUser } from './useStartSingleUser'

const { connectMock, disconnectMock } = vi.hoisted(() => ({
  connectMock: vi.fn(),
  disconnectMock: vi.fn(),
}))

vi.mock('../../../application/ports/useNetworkSession', () => ({
  useNetworkSession: () => ({ connect: connectMock, disconnect: disconnectMock }),
}))

function renderWithPath<T>(hook: () => T, initialPath: string = ROUTES.modeSelect) {
  return renderHook(() => ({ value: hook(), path: useLocation().pathname }), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={[initialPath]}>{children}</MemoryRouter>
    ),
  })
}

beforeEach(() => {
  connectMock.mockClear()
  disconnectMock.mockClear()
  useSessionStore.setState({
    sessionName: '',
    unit: 'days',
    items: [],
    activeItemId: null,
  })
  useConnectionStore.getState().leaveLiveSession()
  useRoundStore.setState({ liveRound: null })
})

describe('useStartSingleUser', () => {
  it('selects the first pending item and opens the workspace', () => {
    useSessionStore.getState().addItem('First')
    useSessionStore.getState().addItem('Second')
    useSessionStore.getState().selectItem(null)
    const { result } = renderWithPath(useStartSingleUser)

    act(() => result.current.value())

    const state = useSessionStore.getState()
    expect(state.activeItemId).toBe(state.items[0]?.id)
    expect(result.current.path).toBe(ROUTES.workspace)
  })

  it('leaves nothing selected when there are no items', () => {
    const { result } = renderWithPath(useStartSingleUser)

    act(() => result.current.value())

    expect(useSessionStore.getState().activeItemId).toBeNull()
  })
})

describe('useStartCollaborative', () => {
  it('selects the first pending item, enters a live facilitator session and connects', () => {
    useSessionStore.getState().addItem('First')
    useSessionStore.getState().selectItem(null)
    const { result } = renderWithPath(useStartCollaborative)

    act(() => result.current.value())

    const code = useConnectionStore.getState().sessionId
    expect(useConnectionStore.getState()).toMatchObject({
      mode: 'live',
      role: 'facilitator',
    })
    expect(useSessionStore.getState().activeItemId).toBe(
      useSessionStore.getState().items[0]?.id,
    )
    expect(connectMock).toHaveBeenCalledTimes(1)
    expect(connectMock).toHaveBeenCalledWith(code)
    expect(result.current.path).toBe(ROUTES.workspace)
  })
})

function seedLiveParticipant() {
  useConnectionStore.getState().joinLiveSession('K7F9Q2', 'Sam', 'p-1')
  useSessionStore.setState({ unit: 'weeks' })
  useRoundStore.setState({
    liveRound: {
      item: { id: 'i', title: 'T', description: '' },
      submissions: [],
      revealed: false,
      round: 0,
      roster: [],
      mySubmission: null,
    },
  })
}

describe('useLeaveLiveSession', () => {
  it('disconnects, resets connection, round and inherited unit, and returns to mode-select', () => {
    seedLiveParticipant()
    useSessionStore.getState().addItem('Keep me')
    const { result } = renderWithPath(useLeaveLiveSession, ROUTES.estimate)

    act(() => result.current.value())

    expect(disconnectMock).toHaveBeenCalledTimes(1)
    expect(useConnectionStore.getState().mode).toBe('manual')
    expect(useRoundStore.getState().liveRound).toBeNull()
    expect(useSessionStore.getState().unit).toBe('days')
    expect(useSessionStore.getState().items).toHaveLength(1)
    expect(result.current.path).toBe(ROUTES.modeSelect)
  })
})

describe('useLeaveWorkspace', () => {
  it('also clears the item list', () => {
    seedLiveParticipant()
    useSessionStore.getState().addItem('Gone')
    const { result } = renderWithPath(useLeaveWorkspace, ROUTES.workspace)

    act(() => result.current.value.leaveWorkspace())

    expect(disconnectMock).toHaveBeenCalledTimes(1)
    expect(useConnectionStore.getState().mode).toBe('manual')
    expect(useRoundStore.getState().liveRound).toBeNull()
    expect(useSessionStore.getState()).toMatchObject({ items: [], unit: 'days' })
    expect(result.current.path).toBe(ROUTES.modeSelect)
  })
})

describe('useLeaveWorkspace needsConfirm', () => {
  it('is false without a live session', () => {
    const { result } = renderWithPath(useLeaveWorkspace, ROUTES.workspace)

    expect(result.current.value.needsConfirm).toBe(false)
  })

  it('is false for a live session with no peers', () => {
    useConnectionStore.setState({ mode: 'live', peerCount: 0 })
    const { result } = renderWithPath(useLeaveWorkspace, ROUTES.workspace)

    expect(result.current.value.needsConfirm).toBe(false)
  })

  it('is true for a live session with peers', () => {
    useConnectionStore.setState({ mode: 'live', peerCount: 2 })
    const { result } = renderWithPath(useLeaveWorkspace, ROUTES.workspace)

    expect(result.current.value.needsConfirm).toBe(true)
  })
})

describe('useReconnect', () => {
  it('reconnects to the current session code', () => {
    useConnectionStore.setState({ sessionId: 'K7F9Q2' })
    const { result } = renderWithPath(useReconnect)

    expect(result.current.value.canReconnect).toBe(true)
    act(() => result.current.value.reconnect())

    expect(connectMock).toHaveBeenCalledTimes(1)
    expect(connectMock).toHaveBeenCalledWith('K7F9Q2')
  })

  it('does nothing without a session to rejoin', () => {
    useConnectionStore.setState({ sessionId: null })
    const { result } = renderWithPath(useReconnect)

    expect(result.current.value.canReconnect).toBe(false)
    act(() => result.current.value.reconnect())

    expect(connectMock).not.toHaveBeenCalled()
  })
})
