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
  it('is null when every item is finalized or there are none', () => {
    expect(firstPendingItemId([finalizedItemOf({ id: 'a' })])).toBeNull()
    expect(firstPendingItemId([])).toBeNull()
  })
})

describe('appendItem', () => {
  it('selects the new item when the selection had been cleared', () => {
    const state = { items: [finalizedItemOf({ id: 'a' })], activeItemId: null }
    expect(
      appendItem(state, { id: 'b', title: 'B', description: '' })?.activeItemId,
    ).toBe('b')
  })
})

describe('removeItemFrom', () => {
  it('leaves the list unchanged for an unknown id', () => {
    const state = { items: [itemOf({ id: 'a' })], activeItemId: 'a' }
    expect(removeItemFrom(state, 'zzz')).toEqual(state)
  })
})

describe('moveItem', () => {
  const items = [itemOf({ id: 'a' }), itemOf({ id: 'b' }), itemOf({ id: 'c' })]
  const ids = (list: ReturnType<typeof moveItem>) => list?.map((i) => i.id)

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

  it('leaves every item untouched for an unknown id', () => {
    expect(renameItem(items, 'zzz', 'New')).toEqual(items)
  })
})
