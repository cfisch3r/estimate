import { describe, expect, expectTypeOf, it } from 'vitest'
import { useConnectionStore as internalConnection } from './connection'
import { useRoundStore as internalRound } from './round'
import { useSessionStore as internalSession } from './session'
import { useConnectionStore, useRoundStore, useSessionStore } from './publicStores'

describe('public store views', () => {
  it('are the same stores the network bridge writes to', () => {
    expect(useConnectionStore).toBe(internalConnection)
    expect(useRoundStore).toBe(internalRound)
    expect(useSessionStore).toBe(internalSession)
  })

  it('keep the transport-driven mutators out of the public type', () => {
    const connection = useConnectionStore.getState()
    const round = useRoundStore.getState()

    expectTypeOf(connection).not.toHaveProperty('setMode')
    expectTypeOf(connection).not.toHaveProperty('setConnectionStatus')
    expectTypeOf(connection).not.toHaveProperty('setPeerCount')
    expectTypeOf(connection).not.toHaveProperty('applyParticipantName')
    expectTypeOf(connection).not.toHaveProperty('removeParticipant')
    expectTypeOf(round).not.toHaveProperty('applyRoundSnapshot')
    expectTypeOf(round).not.toHaveProperty('applyRemoteEstimate')
  })

  it('keep every rule-bearing write behind a use case', () => {
    const connection = useConnectionStore.getState()
    const round = useRoundStore.getState()
    const session = useSessionStore.getState()

    expectTypeOf(connection).not.toHaveProperty('startCollaborative')
    expectTypeOf(connection).not.toHaveProperty('joinLiveSession')
    expectTypeOf(connection).not.toHaveProperty('leaveLiveSession')
    expectTypeOf(round).not.toHaveProperty('revealRound')
    expectTypeOf(round).not.toHaveProperty('retryRound')
    expectTypeOf(round).not.toHaveProperty('finalizeItem')
    expectTypeOf(round).not.toHaveProperty('submitEstimate')
    expectTypeOf(round).not.toHaveProperty('clearRound')
    expectTypeOf(session).not.toHaveProperty('addItem')
    expectTypeOf(session).not.toHaveProperty('removeItem')
    expectTypeOf(session).not.toHaveProperty('reorderItems')
    expectTypeOf(session).not.toHaveProperty('selectFirstPending')
    expectTypeOf(session).not.toHaveProperty('resetUnit')
    expectTypeOf(session).not.toHaveProperty('clearSession')
  })

  it('leave the trivial field setters callable from the UI', () => {
    const session = useSessionStore.getState()

    expectTypeOf(session).toHaveProperty('setSessionName')
    expectTypeOf(session).toHaveProperty('setUnit')
    expectTypeOf(session).toHaveProperty('selectItem')
    expectTypeOf(session).toHaveProperty('setItemTitle')
    expectTypeOf(session).toHaveProperty('setItemNotes')
    expectTypeOf(session).toHaveProperty('setItemDescription')
  })
})
