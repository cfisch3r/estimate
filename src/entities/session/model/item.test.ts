import { describe, expect, it } from 'vitest'
import { isFinalized } from './item'
import { finalizedItemOf, itemOf } from './testFixtures'

describe('isFinalized', () => {
  it('is false while the item has no final result', () => {
    expect(isFinalized(itemOf())).toBe(false)
  })

  it('is true once the item has a final result', () => {
    expect(isFinalized(finalizedItemOf())).toBe(true)
  })
})
