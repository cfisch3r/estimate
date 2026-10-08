import type { StoreApi, UseBoundStore } from 'zustand'
import { useConnectionStore as connectionStore, type ConnectionStore } from './connection'
import { useRoundStore as roundStore, type RoundStore } from './round'
import { useSessionStore as sessionStore, type SessionStore } from './session'

/** What the application barrel exposes of the stores to the UI.
 *
 *  The UI may read state with selectors and may call the trivial field setters
 *  below directly. Every write that carries a rule goes through a use case
 *  (`useItemActions`, `useRevealActions`, `useJoinLiveSession`, ...), and the
 *  transport-driven writes belong to the network bridge. Those actions are not on
 *  these types, so calling one from the UI is a compile error — and the lint rule
 *  that limits the UI to the application barrel stops it importing the full
 *  stores instead. This keeps the facilitator-authoritative model (ADR-003) the
 *  only path by which remote state changes the local one.
 *
 *  Use cases and `NetworkProvider` import the full stores from `./stores`. */
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

export type PublicConnectionStore = Pick<
  ConnectionStore,
  | 'mode'
  | 'role'
  | 'sessionId'
  | 'myName'
  | 'participantId'
  | 'connectionStatus'
  | 'hasEverConnected'
  | 'peerCount'
  | 'participantNames'
>

export type PublicRoundStore = Pick<RoundStore, 'liveRound'>

export const useSessionStore: UseBoundStore<StoreApi<PublicSessionStore>> = sessionStore

export const useConnectionStore: UseBoundStore<StoreApi<PublicConnectionStore>> =
  connectionStore

export const useRoundStore: UseBoundStore<StoreApi<PublicRoundStore>> = roundStore
