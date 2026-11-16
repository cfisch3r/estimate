import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useCloseWorkspace } from './useCloseWorkspace'
import { writeSessionFile } from '../../domain/sessionFile'
import { useConnectionStore, useSessionStore } from '../stores'

const { disconnectMock } = vi.hoisted(() => ({ disconnectMock: vi.fn() }))

vi.mock('./useLiveSession', () => ({
  useLiveSession: () => ({ disconnect: disconnectMock }),
}))

beforeEach(() => {
  disconnectMock.mockClear()
  useSessionStore.setState({
    sessionName: '',
    unit: 'days',
    items: [],
    activeItemId: null,
    lastSavedFile: null,
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

  it('asks for confirmation when leaving a live session that still has peers', () => {
    const { result, rerender } = renderHook(() => useCloseWorkspace())
    expect(result.current.confirmation).toBe('none')

    act(() => {
      useConnectionStore.getState().startCollaborative('K7F9Q2')
    })
    rerender()
    expect(result.current.confirmation).toBe('none')

    act(() => useConnectionStore.setState({ peerCount: 2 }))
    rerender()
    expect(result.current.confirmation).toBe('live-peers')
  })

  it('asks for confirmation when the session has unsaved changes, until it is saved', () => {
    const { result, rerender } = renderHook(() => useCloseWorkspace())

    act(() => useSessionStore.getState().addItem('Story'))
    rerender()
    expect(result.current.confirmation).toBe('unsaved')

    act(() => {
      const { sessionName, unit, items, markSaved } = useSessionStore.getState()
      markSaved(writeSessionFile({ sessionName, unit, items }))
    })
    rerender()
    expect(result.current.confirmation).toBe('none')
  })
})
