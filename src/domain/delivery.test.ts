import { describe, expect, it } from 'vitest'
import { deliveryStateFor } from './delivery'

const roster = [
  { participantId: 'me', submitted: true, connected: true },
  { participantId: 'you', submitted: false, connected: true },
]

describe('deliveryStateFor', () => {
  it('is submitted once the roster shows the own submission, even after a failed send', () => {
    expect(deliveryStateFor(roster, 'me', false)).toBe('submitted')
    expect(deliveryStateFor(roster, 'me', true)).toBe('submitted')
  })

  it('is not-delivered when the send failed and the roster has not caught up', () => {
    expect(deliveryStateFor(roster, 'you', true)).toBe('not-delivered')
  })

  it('is sending while the send is in flight', () => {
    expect(deliveryStateFor(roster, 'you', false)).toBe('sending')
  })

  it('is sending when there is no round or the participant is not on the roster', () => {
    expect(deliveryStateFor(undefined, 'me', false)).toBe('sending')
    expect(deliveryStateFor(roster, 'ghost', false)).toBe('sending')
  })
})
