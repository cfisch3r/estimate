import type { StoreApi, UseBoundStore } from 'zustand'
import { useConnectionStore as connectionStore, type ConnectionStore } from './connection'
import { useRoundStore as roundStore, type RoundStore } from './round'

/** What the slice's public API exposes of the stores.
 *
 *  The network bridge (`api/NetworkProvider.tsx`) is the only writer of the
 *  transport-driven fields, so its mutators stay slice-internal: it imports the
 *  full stores from `./connection` / `./round` directly. Features and pages get
 *  these narrowed views, which carry the read state and the use-case actions
 *  they compose, and no way to (type-correctly) feed in a peer's snapshot,
 *  submission, name or connection status — the facilitator-authoritative model
 *  (ADR-003) stays the only path by which remote state changes the local one. */
type InternalConnectionMutators =
  | 'setMode'
  | 'setConnectionStatus'
  | 'setPeerCount'
  | 'applyParticipantName'
  | 'removeParticipant'
type InternalRoundMutators = 'applySyncState' | 'applyRemoteEstimate'

export type PublicConnectionStore = Omit<ConnectionStore, InternalConnectionMutators>
export type PublicRoundStore = Omit<RoundStore, InternalRoundMutators>

export const useConnectionStore: UseBoundStore<StoreApi<PublicConnectionStore>> =
  connectionStore

export const useRoundStore: UseBoundStore<StoreApi<PublicRoundStore>> = roundStore
