import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createSavedSession } from '../../domain/savedSession'
import type { SavedSession } from '../../domain/savedSession'
import type { PickedFile, SessionFileApi } from '../ports/outbound/sessionFiles'
import { SessionFilesContext } from '../ports/sessionFilesContext'
import { useConnectionStore, useSessionStore } from '../stores'
import { useDiscardSession } from './useDiscardSession'
import { useLoadSessionFile } from './useLoadSessionFile'
import { useSaveSession } from './useSaveSession'
import { useSaveState } from './useSaveState'

function savedSession(): SavedSession {
  const result = createSavedSession({
    sessionName: 'Sprint 42',
    unit: 'weeks',
    items: [
      { id: 'a', title: 'Login', description: '', notes: '', finalResult: null },
      { id: 'b', title: 'Search', description: '', notes: '', finalResult: null },
    ],
  })
  if (!result.ok) throw new Error('the test session breaks a rule')
  return result.value
}

const PICKED: PickedFile = {
  name: 'sprint-42.estimate.json',
  text: () => Promise.resolve('read by the fake port, never here'),
}

const sessionFiles = {
  save: vi.fn<SessionFileApi['save']>(() => 'sprint-42-2026-11-12.estimate.json'),
  open: vi.fn<SessionFileApi['open']>(),
}
const withSessionFiles = ({ children }: { children: ReactNode }) => (
  <SessionFilesContext.Provider value={sessionFiles}>
    {children}
  </SessionFilesContext.Provider>
)

beforeEach(() => {
  sessionFiles.save.mockClear()
  sessionFiles.open.mockReset()
  sessionFiles.open.mockResolvedValue({ ok: true, value: savedSession() })
  useSessionStore.setState({
    sessionName: '',
    unit: 'days',
    items: [],
    activeItemId: null,
    savedBaseline: null,
    loadedFrom: null,
  })
  useConnectionStore.getState().leaveLiveSession()
})

async function load(file: PickedFile = PICKED) {
  const { result } = renderHook(() => useLoadSessionFile(), { wrapper: withSessionFiles })
  let outcome
  await act(async () => {
    outcome = await result.current(file)
  })
  return outcome
}

describe('useSaveSession', () => {
  it('saves what a save keeps, dated today, and marks it saved', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 12, 9, 30))
    useSessionStore.getState().setSessionName('Checkout rework')
    useSessionStore.getState().addItem('Payment provider switch')
    const { result } = renderHook(() => useSaveSession(), { wrapper: withSessionFiles })
    const unsaved = renderHook(() => useSaveState().unsaved)
    expect(unsaved.result.current).toBe(true)

    let fileName
    act(() => {
      fileName = result.current()
    })

    expect(fileName).toBe('sprint-42-2026-11-12.estimate.json')
    expect(sessionFiles.save).toHaveBeenCalledTimes(1)
    const [saved, savedOn] = sessionFiles.save.mock.calls[0] ?? []
    expect(savedOn).toEqual({ year: 2026, month: 11, day: 12 })
    expect(saved?.sessionName).toBe('Checkout rework')
    expect(saved?.items.map((item) => item.title)).toEqual(['Payment provider switch'])
    expect(useSessionStore.getState().savedBaseline).toBe(saved)
    unsaved.rerender()
    expect(unsaved.result.current).toBe(false)
    vi.useRealTimers()
  })

  it('needs a session-file provider', () => {
    expect(() => renderHook(() => useSaveSession())).toThrow(/SessionFilesContext/)
  })
})

describe('useLoadSessionFile', () => {
  it('replaces the session with the file and counts it as saved', async () => {
    useSessionStore.getState().addItem('Old')

    const outcome = await load()

    expect(sessionFiles.open).toHaveBeenCalledTimes(1)
    expect(sessionFiles.open).toHaveBeenCalledWith(PICKED)
    expect(outcome).toEqual({ ok: true, value: undefined })
    expect(useSessionStore.getState()).toMatchObject({
      sessionName: 'Sprint 42',
      unit: 'weeks',
      activeItemId: null,
      loadedFrom: 'sprint-42.estimate.json',
    })
    expect(useSessionStore.getState().items).toEqual([
      expect.objectContaining({ title: 'Login', submissions: [], round: 0 }),
      expect.objectContaining({ title: 'Search', submissions: [], round: 0 }),
    ])
    expect(renderHook(() => useSaveState().unsaved).result.current).toBe(false)
  })

  it('leaves the session untouched when the file is rejected', async () => {
    sessionFiles.open.mockResolvedValue({
      ok: false,
      error: { code: 'not-a-session-file' },
    })
    useSessionStore.getState().addItem('Kept')

    const outcome = await load()

    expect(outcome).toEqual({ ok: false, error: { code: 'not-a-session-file' } })
    expect(useSessionStore.getState().items.map((item) => item.title)).toEqual(['Kept'])
  })
})

describe('useDiscardSession', () => {
  it('drops a loaded session, its unit and its saved state', async () => {
    await load()
    const { result } = renderHook(() => useDiscardSession())

    act(() => result.current())

    expect(useSessionStore.getState()).toMatchObject({
      sessionName: '',
      unit: 'days',
      items: [],
      savedBaseline: null,
      loadedFrom: null,
    })
  })
})

describe('useSaveState', () => {
  it("gives a participant nothing to save, even with the facilitator's session name", () => {
    useConnectionStore.setState({ mode: 'live', role: 'participant' })
    useSessionStore.getState().setSessionName('Sprint 42')

    const { result } = renderHook(() => useSaveState())

    expect(result.current).toEqual({ canSave: false, unsaved: false })
  })

  it('counts a changed unit as unsaved for the facilitator', () => {
    useSessionStore.getState().setUnit('hours')

    expect(renderHook(() => useSaveState()).result.current).toEqual({
      canSave: true,
      unsaved: true,
    })
  })
})
