import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useStartCollaborativeSession } from './useStartCollaborativeSession'
import { useStartSingleUserSession } from './useStartSingleUserSession'
import { useConnectionStore, useSessionStore } from '../stores'

const { connectMock } = vi.hoisted(() => ({ connectMock: vi.fn() }))

vi.mock('./useLiveSession', () => ({
  useLiveSession: () => ({ connect: connectMock }),
}))

beforeEach(() => {
  connectMock.mockClear()
  useSessionStore.setState({
    sessionName: '',
    unit: 'days',
    items: [],
    activeItemId: null,
  })
  useConnectionStore.getState().leaveLiveSession()
  useSessionStore.getState().addItem('First')
  useSessionStore.getState().addItem('Second')
  useSessionStore.getState().selectItem(null)
})

describe('useStartSingleUserSession', () => {
  it('selects the first pending item', () => {
    const { result } = renderHook(() => useStartSingleUserSession())

    act(() => result.current())

    const state = useSessionStore.getState()
    expect(state.activeItemId).toBe(state.items[0]?.id)
  })
})

describe('useStartCollaborativeSession', () => {
  it('selects the first item, starts a facilitator session and connects with its code', () => {
    const { result } = renderHook(() => useStartCollaborativeSession())

    act(() => result.current())

    const { mode, role, sessionId } = useConnectionStore.getState()
    expect(mode).toBe('live')
    expect(role).toBe('facilitator')
    expect(sessionId).toMatch(/^[0-9A-Z]{6}$/)
    expect(useSessionStore.getState().activeItemId).toBe(
      useSessionStore.getState().items[0]?.id,
    )
    expect(connectMock).toHaveBeenCalledTimes(1)
    expect(connectMock).toHaveBeenCalledWith(sessionId)
  })
})
