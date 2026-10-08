import { describe, expect, it } from 'vitest'
import { advanceFrom, previousItemId } from './navigation'
import { finalizedItemOf, itemOf } from './testFixtures'

describe('advanceFrom', () => {
  it('does nothing without a valid active item', () => {
    expect(advanceFrom([itemOf({ id: 'a' })], -1)).toEqual({ kind: 'none' })
    expect(advanceFrom([], 0)).toEqual({ kind: 'none' })
  })

  it('selects the adjacent next item, finalized or not', () => {
    const items = [itemOf({ id: 'a' }), finalizedItemOf({ id: 'b' })]
    expect(advanceFrom(items, 0)).toEqual({ kind: 'select', itemId: 'b' })
  })

  it('goes to the summary and clears the selection when everything else is finalized', () => {
    const items = [finalizedItemOf({ id: 'a' }), itemOf({ id: 'b' })]
    expect(advanceFrom(items, 1)).toEqual({ kind: 'summary', clearSelection: true })
  })

  it('goes to the summary but keeps the selection while another item is pending', () => {
    const items = [itemOf({ id: 'a' }), itemOf({ id: 'b' })]
    expect(advanceFrom(items, 1)).toEqual({ kind: 'summary', clearSelection: false })
  })

  it('treats a single, just-finalized item as complete', () => {
    expect(advanceFrom([itemOf({ id: 'a' })], 0)).toEqual({
      kind: 'summary',
      clearSelection: true,
    })
  })
})

describe('previousItemId', () => {
  const items = [itemOf({ id: 'a' }), itemOf({ id: 'b' })]

  it('returns the adjacent previous item', () => {
    expect(previousItemId(items, 1)).toBe('a')
  })

  it('is null at the first item or without a valid active item', () => {
    expect(previousItemId(items, 0)).toBeNull()
    expect(previousItemId(items, -1)).toBeNull()
    expect(previousItemId(items, 5)).toBeNull()
  })
})
