import { describe, expect, it } from 'vitest'
import {
  appendItem,
  firstPendingItemId,
  isFinalized,
  moveItem,
  removeItemFrom,
  renameItem,
  updateItem,
} from './item'
import { finalizedItemOf, itemOf } from './testFixtures'

describe('isFinalized', () => {
  it('is false while the item has no final result', () => {
    expect(isFinalized(itemOf())).toBe(false)
  })

  it('is true once the item has a final result', () => {
    expect(isFinalized(finalizedItemOf())).toBe(true)
  })
})

describe('firstPendingItemId', () => {
  it('returns the first item without a final result', () => {
    const items = [finalizedItemOf({ id: 'a' }), itemOf({ id: 'b' }), itemOf({ id: 'c' })]
    expect(firstPendingItemId(items)).toBe('b')
  })

  it('is null when every item is finalized or there are none', () => {
    expect(firstPendingItemId([finalizedItemOf({ id: 'a' })])).toBeNull()
    expect(firstPendingItemId([])).toBeNull()
  })
})

describe('appendItem', () => {
  const empty = { items: [], activeItemId: null }

  it('appends a trimmed item with empty notes, no result and round 0', () => {
    const next = appendItem(empty, { id: 'x', title: '  Migrate  ', description: 'd' })
    expect(next?.items).toEqual([
      {
        id: 'x',
        title: 'Migrate',
        description: 'd',
        notes: '',
        finalResult: null,
        submissions: [],
        revealed: false,
        round: 0,
      },
    ])
  })

  it('is a no-op for a blank title', () => {
    expect(appendItem(empty, { id: 'x', title: '   ', description: '' })).toBeNull()
  })

  it('selects the first item added to an empty workspace', () => {
    expect(
      appendItem(empty, { id: 'x', title: 'A', description: '' })?.activeItemId,
    ).toBe('x')
  })

  it('keeps the active item when adding a later one', () => {
    const state = { items: [itemOf({ id: 'a' })], activeItemId: 'a' }
    const next = appendItem(state, { id: 'b', title: 'B', description: '' })
    expect(next?.activeItemId).toBe('a')
    expect(next?.items.map((i) => i.id)).toEqual(['a', 'b'])
  })

  it('selects the new item when the selection had been cleared', () => {
    const state = { items: [finalizedItemOf({ id: 'a' })], activeItemId: null }
    expect(
      appendItem(state, { id: 'b', title: 'B', description: '' })?.activeItemId,
    ).toBe('b')
  })
})

describe('removeItemFrom', () => {
  it('keeps the selection when a different item is removed', () => {
    const state = { items: [itemOf({ id: 'a' }), itemOf({ id: 'b' })], activeItemId: 'a' }
    expect(removeItemFrom(state, 'b')).toEqual({
      items: [itemOf({ id: 'a' })],
      activeItemId: 'a',
    })
  })

  it('falls back to the next pending item when the active one is removed', () => {
    const state = {
      items: [itemOf({ id: 'a' }), finalizedItemOf({ id: 'b' }), itemOf({ id: 'c' })],
      activeItemId: 'a',
    }
    expect(removeItemFrom(state, 'a').activeItemId).toBe('c')
  })

  it('clears the selection when no pending item remains', () => {
    const state = {
      items: [itemOf({ id: 'a' }), finalizedItemOf({ id: 'b' })],
      activeItemId: 'a',
    }
    expect(removeItemFrom(state, 'a').activeItemId).toBeNull()
  })

  it('leaves the list unchanged for an unknown id', () => {
    const state = { items: [itemOf({ id: 'a' })], activeItemId: 'a' }
    expect(removeItemFrom(state, 'zzz')).toEqual(state)
  })
})

describe('moveItem', () => {
  const items = [itemOf({ id: 'a' }), itemOf({ id: 'b' }), itemOf({ id: 'c' })]
  const ids = (list: ReturnType<typeof moveItem>) => list?.map((i) => i.id)

  it('moves an item to a new index', () => {
    expect(ids(moveItem(items, 0, 2))).toEqual(['b', 'c', 'a'])
    expect(ids(moveItem(items, 2, 0))).toEqual(['c', 'a', 'b'])
  })

  it('does not mutate its input', () => {
    moveItem(items, 0, 2)
    expect(ids(items)).toEqual(['a', 'b', 'c'])
  })

  it('is a no-op for an out-of-range source index', () => {
    expect(moveItem(items, 5, 0)).toBeNull()
    expect(moveItem(items, -1, 0)).toBeNull()
  })

  it('clamps an out-of-range target index to the end', () => {
    expect(ids(moveItem(items, 0, 99))).toEqual(['b', 'c', 'a'])
  })
})

describe('updateItem', () => {
  it('patches only the matching item', () => {
    const items = [itemOf({ id: 'a' }), itemOf({ id: 'b' })]
    const next = updateItem(items, 'b', { notes: 'n' })
    expect(next[0]).toBe(items[0])
    expect(next[1]?.notes).toBe('n')
  })

  it('leaves every item untouched for an unknown id', () => {
    const items = [itemOf({ id: 'a' })]
    expect(updateItem(items, 'zzz', { notes: 'n' })).toEqual(items)
  })
})

describe('renameItem', () => {
  const items = [itemOf({ id: 'a', title: 'Old' }), itemOf({ id: 'b', title: 'Other' })]

  it('renames the matching item to the trimmed title', () => {
    const next = renameItem(items, 'a', '  New  ')
    expect(next?.map((i) => i.title)).toEqual(['New', 'Other'])
  })

  it('is a no-op for a blank title, like appendItem', () => {
    expect(renameItem(items, 'a', '   ')).toBeNull()
    expect(renameItem(items, 'a', '')).toBeNull()
  })

  it('leaves every item untouched for an unknown id', () => {
    expect(renameItem(items, 'zzz', 'New')).toEqual(items)
  })
})
