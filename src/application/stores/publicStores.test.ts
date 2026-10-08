import { describe, expect, expectTypeOf, it } from 'vitest'
import { useConnectionStore as internalConnection } from './connection'
import { useRoundStore as internalRound } from './round'
import { useSessionStore as internalSession } from './session'
import {
  useConnectionStore,
  useRoundStore,
  useSessionStore,
  type PublicConnectionStore,
  type PublicRoundStore,
  type PublicSessionStore,
} from './publicStores'

describe('public store views', () => {
  it('are the same stores the use cases and the network bridge write to', () => {
    expect(useConnectionStore).toBe(internalConnection)
    expect(useRoundStore).toBe(internalRound)
    expect(useSessionStore).toBe(internalSession)
  })

  // These are exact key lists on purpose: widening what the UI can see of a store
  // has to come with a change here (ADR-009).
  it('expose the session state and only the trivial field setters', () => {
    expectTypeOf<keyof PublicSessionStore>().toEqualTypeOf<
      | 'sessionName'
      | 'unit'
      | 'items'
      | 'activeItemId'
      | 'setSessionName'
      | 'setUnit'
      | 'selectItem'
      | 'setItemTitle'
      | 'setItemNotes'
      | 'setItemDescription'
    >()
  })

  it('expose the connection state and no actions', () => {
    expectTypeOf<keyof PublicConnectionStore>().toEqualTypeOf<
      | 'mode'
      | 'role'
      | 'sessionId'
      | 'myName'
      | 'participantId'
      | 'connectionStatus'
      | 'hasEverConnected'
      | 'peerCount'
      | 'participantNames'
    >()
  })

  it('expose the round view and no actions', () => {
    expectTypeOf<keyof PublicRoundStore>().toEqualTypeOf<'liveRound'>()
  })

  it('offer reads only: no setState, so state cannot be written around the use cases', () => {
    expectTypeOf(useSessionStore).not.toHaveProperty('setState')
    expectTypeOf(useConnectionStore).not.toHaveProperty('setState')
    expectTypeOf(useRoundStore).not.toHaveProperty('setState')
    expectTypeOf(useSessionStore).toHaveProperty('getState')
    expectTypeOf(useSessionStore).toHaveProperty('subscribe')
  })
})
