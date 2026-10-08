import type { StoreApi } from 'zustand'
import { useConnectionStore as connectionStore, type ConnectionState } from './connection'
import { useRoundStore as roundStore, type RoundStore } from './round'
import { useSessionStore as sessionStore, type SessionStore } from './session'

/** What the application barrel exposes of the stores to the UI.
 *
 *  The UI may read state with selectors (and `getState` / `subscribe`) and may
 *  call the trivial field setters of the session store below. It cannot write
 *  state any other way: the views have no `setState`, and every action that
 *  carries a rule (`useItemActions`, `useRevealActions`, `useJoinLiveSession`, ...)
 *  or that the network bridge owns is absent from the types, so calling one is a
 *  compile error. The lint rule that limits the UI to the application barrel
 *  stops it importing the full stores instead. This keeps the
 *  facilitator-authoritative model (ADR-003) the only path by which remote state
 *  changes the local one.
 *
 *  Use cases and `NetworkProvider` import the full stores from `./stores`; tests
 *  that seed state use `application/testing`. */
export type ReadOnlyStore<T> = {
  (): T
  <U>(selector: (state: T) => U): U
} & Pick<StoreApi<T>, 'getState' | 'subscribe'>

export type PublicSessionStore = Pick<
  SessionStore,
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
>

export type PublicConnectionStore = ConnectionState

export type PublicRoundStore = Pick<RoundStore, 'liveRound'>

export const useSessionStore: ReadOnlyStore<PublicSessionStore> = sessionStore

export const useConnectionStore: ReadOnlyStore<PublicConnectionStore> = connectionStore

export const useRoundStore: ReadOnlyStore<PublicRoundStore> = roundStore
