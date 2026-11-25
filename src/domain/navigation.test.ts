import { describe, expect, it } from 'vitest'
import { advanceFrom, previousItemId } from './navigation'
import { itemOf } from './testFixtures'

describe('advanceFrom', () => {
  it('does nothing without a valid active item', () => {
    expect(advanceFrom([itemOf({ id: 'a' })], -1)).toEqual({ kind: 'none' })
    expect(advanceFrom([], 0)).toEqual({ kind: 'none' })
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

  it('is null at the first item or without a valid active item', () => {
    expect(previousItemId(items, 0)).toBeNull()
    expect(previousItemId(items, -1)).toBeNull()
    expect(previousItemId(items, 5)).toBeNull()
  })
})
