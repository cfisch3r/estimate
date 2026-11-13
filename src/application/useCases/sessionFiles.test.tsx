import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { readSessionFile, writeSessionFile } from '../../domain/sessionFile'
import { FileDownloadContext } from '../ports/fileDownloadContext'
import { useSessionStore } from '../stores'
import { useSaveSession } from './useSaveSession'
import { useLoadSessionFile } from './useLoadSessionFile'
import { useHasUnsavedChanges } from './useHasUnsavedChanges'
import { useDiscardSession } from './useDiscardSession'

const download = vi.fn()
const withDownload = ({ children }: { children: ReactNode }) => (
  <FileDownloadContext.Provider value={{ download }}>
    {children}
  </FileDownloadContext.Provider>
)

const SAVED = JSON.stringify({
  version: 1,
  sessionName: 'Sprint 42',
  unit: 'weeks',
  items: [
    { id: 'a', title: 'Login', description: '', notes: '', finalResult: null },
    { id: 'b', title: 'Search', description: '', notes: '', finalResult: null },
  ],
})

beforeEach(() => {
  download.mockClear()
  useSessionStore.setState({
    sessionName: '',
    unit: 'days',
    items: [],
    activeItemId: null,
    lastSavedFile: null,
  })
})

describe('useSaveSession', () => {
  it('downloads the session as a dated file and marks it saved', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 12, 9, 30))
    useSessionStore.getState().setSessionName('Checkout rework')
    useSessionStore.getState().addItem('Payment provider switch')
    const { result } = renderHook(() => useSaveSession(), { wrapper: withDownload })
    const unsaved = renderHook(() => useHasUnsavedChanges())
    expect(unsaved.result.current).toBe(true)

    act(() => result.current())

    expect(download).toHaveBeenCalledTimes(1)
    const [fileName, text] = download.mock.calls[0] as [string, string]
    expect(fileName).toBe('checkout-rework-2026-11-12.estimate.json')
    const read = readSessionFile(text)
    expect(read.ok && read.value.items.map((item) => item.title)).toEqual([
      'Payment provider switch',
    ])
    unsaved.rerender()
    expect(unsaved.result.current).toBe(false)
    vi.useRealTimers()
  })

  it('needs a download provider', () => {
    expect(() => renderHook(() => useSaveSession())).toThrow(/FileDownloadContext/)
  })
})

describe('useLoadSessionFile', () => {
  it('replaces the session with the file and counts it as saved', () => {
    useSessionStore.getState().addItem('Old')
    const { result } = renderHook(() => useLoadSessionFile())

    let outcome
    act(() => {
      outcome = result.current(SAVED)
    })

    expect(outcome).toEqual({ ok: true, value: undefined })
    expect(useSessionStore.getState()).toMatchObject({
      sessionName: 'Sprint 42',
      unit: 'weeks',
      activeItemId: null,
    })
    expect(useSessionStore.getState().items.map((item) => item.title)).toEqual([
      'Login',
      'Search',
    ])
    expect(renderHook(() => useHasUnsavedChanges()).result.current).toBe(false)
  })

  it('leaves the session untouched when the file is rejected', () => {
    useSessionStore.getState().addItem('Kept')
    const { result } = renderHook(() => useLoadSessionFile())

    let outcome
    act(() => {
      outcome = result.current('not json')
    })

    expect(outcome).toEqual({ ok: false, error: "This isn't an EstiMate session file." })
    expect(useSessionStore.getState().items.map((item) => item.title)).toEqual(['Kept'])
  })
})

describe('useDiscardSession', () => {
  it('drops a loaded session and its saved state', () => {
    renderHook(() => useLoadSessionFile()).result.current(SAVED)
    const { result } = renderHook(() => useDiscardSession())

    act(() => result.current())

    expect(useSessionStore.getState()).toMatchObject({
      sessionName: '',
      items: [],
      lastSavedFile: null,
    })
  })
})

describe('the saved file', () => {
  it('is what the store remembers after a load', () => {
    renderHook(() => useLoadSessionFile()).result.current(SAVED)
    const { sessionName, unit, items, lastSavedFile } = useSessionStore.getState()
    expect(lastSavedFile).toBe(writeSessionFile({ sessionName, unit, items }))
  })
})
