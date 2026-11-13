import { beforeEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useSessionStore } from '../../../application/testing'
import { useWarnBeforeUnload } from './useWarnBeforeUnload'

function unload(): Event {
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  return event
}

beforeEach(() => {
  useSessionStore.setState({
    sessionName: '',
    unit: 'days',
    items: [],
    activeItemId: null,
    lastSavedFile: null,
  })
})

describe('useWarnBeforeUnload', () => {
  it('lets an untouched session close without a warning', () => {
    renderHook(() => useWarnBeforeUnload())

    expect(unload().defaultPrevented).toBe(false)
  })

  it('warns while there are unsaved changes, and stops once they are gone', () => {
    const { unmount } = renderHook(() => useWarnBeforeUnload())

    act(() => useSessionStore.getState().addItem('Story'))
    expect(unload().defaultPrevented).toBe(true)

    act(() => useSessionStore.getState().clearSession())
    expect(unload().defaultPrevented).toBe(false)
    unmount()
  })
})
