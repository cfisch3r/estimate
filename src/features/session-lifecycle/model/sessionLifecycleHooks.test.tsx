import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import {
  resetConnectionStore,
  useConnectionStore,
  useRoundStore,
  useSessionStore,
} from '../../../application/testing'
import { itemOf } from '../../../domain/testFixtures'
import { ROUTES } from '../../../shared/lib/routes'
import { useLeaveLiveSession } from './useLeaveLiveSession'
import { useLeaveWorkspace } from './useLeaveWorkspace'
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

function seedItems(...titles: string[]) {
  useSessionStore.setState({
    items: titles.map((title, i) => itemOf({ id: `item-${i}`, title })),
    activeItemId: null,
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
  resetConnectionStore()
  useRoundStore.setState({ liveRound: null })
})

describe('useStartSingleUser', () => {
  it('selects the first pending item and opens the workspace', () => {
    seedItems('First', 'Second')
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
    seedItems('First')
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
  useConnectionStore.setState({
    mode: 'live',
    role: 'participant',
    sessionId: 'K7F9Q2',
    myName: 'Sam',
    participantId: 'p-1',
    connectionStatus: 'connecting',
  })
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
    seedItems('Keep me')
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
    seedItems('Gone')
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
