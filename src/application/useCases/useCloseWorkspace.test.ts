import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useCloseWorkspace } from './useCloseWorkspace'
import { useConnectionStore, useSessionStore } from '../stores'

const { disconnectMock } = vi.hoisted(() => ({ disconnectMock: vi.fn() }))

vi.mock('../ports/useNetworkSession', () => ({
  useNetworkSession: () => ({ disconnect: disconnectMock }),
}))

beforeEach(() => {
  disconnectMock.mockClear()
  useSessionStore.setState({
    sessionName: '',
    unit: 'days',
    items: [],
    activeItemId: null,
  })
  useConnectionStore.getState().leaveLiveSession()
})

describe('useCloseWorkspace', () => {
  it('disconnects, resets the live session and clears the item list', () => {
    useSessionStore.getState().addItem('Story')
    useConnectionStore.getState().startCollaborative('K7F9Q2')
    const { result } = renderHook(() => useCloseWorkspace())

    act(() => result.current.closeWorkspace())

    expect(disconnectMock).toHaveBeenCalledTimes(1)
    expect(useConnectionStore.getState().mode).toBe('manual')
    expect(useSessionStore.getState().items).toEqual([])
  })

  it('asks for confirmation only when leaving a live session that still has peers', () => {
    const { result, rerender } = renderHook(() => useCloseWorkspace())
    expect(result.current.needsConfirm).toBe(false)

    act(() => {
      useConnectionStore.getState().startCollaborative('K7F9Q2')
    })
    rerender()
    expect(result.current.needsConfirm).toBe(false)

    act(() => useConnectionStore.setState({ peerCount: 2 }))
    rerender()
    expect(result.current.needsConfirm).toBe(true)
  })
})
