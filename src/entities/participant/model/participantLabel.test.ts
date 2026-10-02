import { describe, expect, it } from 'vitest'
import { announcedName, teammateLabel } from './participantLabel'

describe('announcedName', () => {
  it('returns the announced name for a known participant', () => {
    expect(announcedName({ p1: 'Sam' }, 'p1')).toBe('Sam')
  })

  it('returns undefined for an unknown participant', () => {
    expect(announcedName({ p1: 'Sam' }, 'p2')).toBeUndefined()
  })

  it('ignores ids that collide with Object.prototype keys', () => {
    expect(announcedName({}, 'toString')).toBeUndefined()
    expect(announcedName({}, 'constructor')).toBeUndefined()
  })
})

describe('teammateLabel', () => {
  it('numbers the fallback label', () => {
    expect(teammateLabel(2)).toBe('Teammate 2')
  })
})
