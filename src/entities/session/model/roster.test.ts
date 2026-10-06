import { describe, expect, it } from 'vitest'
import { buildRoster, roundMemberIds, shouldPruneDeparted } from './roster'

describe('roundMemberIds', () => {
  it('lists announced participants but never the facilitator', () => {
    expect(roundMemberIds({ facilitator: 'Facilitator', a: 'Ada', b: 'Bo' }, [])).toEqual(
      ['a', 'b'],
    )
  })

  it('appends submitters who have not announced, without duplicating announced ones', () => {
    expect(roundMemberIds({ a: 'Ada' }, ['a', 'ghost', 'ghost'])).toEqual(['a', 'ghost'])
  })

  it('is empty for an empty round', () => {
    expect(roundMemberIds({}, [])).toEqual([])
  })
})

describe('buildRoster', () => {
  it('marks who submitted and who is connected, values-free', () => {
    expect(
      buildRoster(
        { facilitator: 'F', a: 'Ada', b: 'Bo' },
        ['a', 'ghost'],
        new Set(['b']),
      ),
    ).toEqual([
      { participantId: 'a', submitted: true, connected: false },
      { participantId: 'b', submitted: false, connected: true },
      { participantId: 'ghost', submitted: true, connected: false },
    ])
  })
})

describe('shouldPruneDeparted', () => {
  it('prunes someone with no remaining connection and no submission', () => {
    expect(shouldPruneDeparted('a', ['b'], ['c'])).toBe(true)
  })

  it('keeps a name still backed by another live connection', () => {
    expect(shouldPruneDeparted('a', ['b', 'a'], [])).toBe(false)
  })

  it('keeps the name of someone who already submitted', () => {
    expect(shouldPruneDeparted('a', [], ['a'])).toBe(false)
  })
})
