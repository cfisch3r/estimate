import { describe, expect, it } from 'vitest'
import { announcedName, participantLabels, teammateLabel } from './participantLabel'

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

describe('participantLabels', () => {
  it('prefers announced names and labels self without consuming a number', () => {
    expect(
      participantLabels(['me', 'a', 'b'], { a: 'Ada' }, { id: 'me', label: 'You' }),
    ).toEqual(['You', 'Ada', 'Teammate 2'])
  })

  it('counts named peers too, so an unnamed peer keeps its number when another peer is named', () => {
    expect(participantLabels(['a', 'b'], {})).toEqual(['Teammate 1', 'Teammate 2'])
    expect(participantLabels(['a', 'b'], { a: 'Ada' })).toEqual(['Ada', 'Teammate 2'])
  })

  it('numbers every id when there is no self', () => {
    expect(participantLabels(['x'], {})).toEqual(['Teammate 1'])
  })
})
