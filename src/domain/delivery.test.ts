import { describe, expect, it } from 'vitest'
import { deliveryStateFor } from './delivery'

const roster = [
  { participantId: 'me', submitted: true, connected: true },
  { participantId: 'you', submitted: false, connected: true },
]

describe('deliveryStateFor', () => {
  it('is sending when there is no round or the participant is not on the roster', () => {
    expect(deliveryStateFor(undefined, 'me', false)).toBe('sending')
    expect(deliveryStateFor(roster, 'ghost', false)).toBe('sending')
  })
})
