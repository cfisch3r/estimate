import { describe, expect, expectTypeOf, it } from 'vitest'
import { useConnectionStore as internalConnection } from './connection'
import { useRoundStore as internalRound } from './round'
import { useConnectionStore, useRoundStore } from './publicStores'

describe('public store views', () => {
  it('are the same stores the network bridge writes to', () => {
    expect(useConnectionStore).toBe(internalConnection)
    expect(useRoundStore).toBe(internalRound)
  })

  it('keep the transport-driven mutators out of the public type', () => {
    const connection = useConnectionStore.getState()
    const round = useRoundStore.getState()

    expectTypeOf(connection).not.toHaveProperty('setConnectionStatus')
    expectTypeOf(connection).not.toHaveProperty('setPeerCount')
    expectTypeOf(connection).not.toHaveProperty('applyParticipantName')
    expectTypeOf(connection).not.toHaveProperty('removeParticipant')
    expectTypeOf(round).not.toHaveProperty('applySyncState')
    expectTypeOf(round).not.toHaveProperty('applyRemoteEstimate')
    // ...while the use-case actions features compose stay reachable.
    expectTypeOf(connection).toHaveProperty('joinLiveSession')
    expectTypeOf(round).toHaveProperty('revealRound')
  })
})
