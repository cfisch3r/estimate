import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useReconnect } from './useReconnect'
import { useConnectionStore } from '../stores'

const { connectMock } = vi.hoisted(() => ({ connectMock: vi.fn() }))

vi.mock('./useLiveSession', () => ({
  useLiveSession: () => ({ connect: connectMock }),
}))

beforeEach(() => {
  connectMock.mockClear()
})

describe('useReconnect', () => {
  it('reconnects to the current session code', () => {
    useConnectionStore.setState({ sessionId: 'K7F9Q2' })
    const { result } = renderHook(() => useReconnect())

    expect(result.current.canReconnect).toBe(true)
    act(() => result.current.reconnect())

    expect(connectMock).toHaveBeenCalledTimes(1)
    expect(connectMock).toHaveBeenCalledWith('K7F9Q2')
  })

  it('does nothing without a session to rejoin', () => {
    useConnectionStore.setState({ sessionId: null })
    const { result } = renderHook(() => useReconnect())

    expect(result.current.canReconnect).toBe(false)
    act(() => result.current.reconnect())

    expect(connectMock).not.toHaveBeenCalled()
  })
})
