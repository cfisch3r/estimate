import { beforeEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useItemActions } from './useItemActions'
import { useSessionStore } from '../stores'

beforeEach(() => {
  useSessionStore.setState({
    sessionName: '',
    unit: 'days',
    items: [],
    activeItemId: null,
  })
})

function titles(): string[] {
  return useSessionStore.getState().items.map((i) => i.title)
}

describe('useItemActions', () => {
  it('adds items, ignoring a blank title, and selects the first one', () => {
    const { result } = renderHook(() => useItemActions())

    act(() => {
      result.current.addItem('First')
      result.current.addItem('   ')
      result.current.addItem('Second')
    })

    expect(titles()).toEqual(['First', 'Second'])
    expect(useSessionStore.getState().activeItemId).toBe(
      useSessionStore.getState().items[0]?.id,
    )
  })

  it('reorders items and ignores an out-of-range source index', () => {
    const { result } = renderHook(() => useItemActions())
    act(() => {
      result.current.addItem('A')
      result.current.addItem('B')
      result.current.addItem('C')
    })

    act(() => result.current.reorderItems(0, 2))
    expect(titles()).toEqual(['B', 'C', 'A'])

    act(() => result.current.reorderItems(9, 0))
    expect(titles()).toEqual(['B', 'C', 'A'])
  })

  it('removes an item and moves the selection to the next pending one', () => {
    const { result } = renderHook(() => useItemActions())
    act(() => {
      result.current.addItem('A')
      result.current.addItem('B')
    })
    const [a, b] = useSessionStore.getState().items

    act(() => result.current.removeItem(a!.id))

    expect(titles()).toEqual(['B'])
    expect(useSessionStore.getState().activeItemId).toBe(b!.id)
  })

  it('returns the same object across renders', () => {
    const { result, rerender } = renderHook(() => useItemActions())
    const first = result.current

    rerender()

    expect(result.current).toBe(first)
  })
})
