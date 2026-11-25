import { describe, expect, it } from 'vitest'
import { roundMemberIds } from './roster'

describe('roundMemberIds', () => {
  it('is empty for an empty round', () => {
    expect(roundMemberIds({}, [])).toEqual([])
  })
})
