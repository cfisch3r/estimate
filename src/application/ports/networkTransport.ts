import type { Estimate } from '../../domain/estimate'
import type { ConnectionStatus, SessionSnapshot } from '../../domain/types'

// The peer transport the live-session controller talks to. The application layer
// owns this interface; `adapters/network` implements it (ADR-009). No React here,
// so adapters may import it.

type Unsubscribe = () => void

/** The transport's own view of the link: its status and the peers it can reach. */
export interface ConnectionState {
  status: ConnectionStatus
  peerIds: string[]
}

/** A client announcing which display name belongs to its `participantId`, so
 *  peers can label reveal rows with real names instead of "Teammate N". Kept off
 *  the pure `Estimate` wire type — names never enter the estimate core. */
export interface ParticipantAnnounce {
  participantId: string
  name: string
}

export interface NetworkSession {
  sendEstimate(
    itemId: string,
    estimate: Estimate,
    round: number,
    target: string,
  ): Promise<void>
  sendSyncState(snapshot: SessionSnapshot): void
  sendAnnounce(announce: ParticipantAnnounce): void
  /** A peer that just (re)connected pulls the facilitator's current snapshot
   *  itself (ADR-003, "Snapshot delivery: pull on arrival"). */
  requestSnapshot(targetPeerId: string): Promise<SessionSnapshot>
  onEstimate(
    cb: (
      itemId: string,
      estimate: Estimate,
      peerId: string,
      round: number | undefined,
    ) => void,
  ): Unsubscribe
  onSyncState(cb: (snapshot: SessionSnapshot, peerId: string) => void): Unsubscribe
  onAnnounce(cb: (announce: ParticipantAnnounce, peerId: string) => void): Unsubscribe
  /** Facilitator-only: answers a peer's `requestSnapshot` pull. */
  onRequestSnapshot(cb: () => SessionSnapshot): Unsubscribe
  onPeerJoin(cb: (peerId: string) => void): Unsubscribe
  onPeerLeave(cb: (peerId: string) => void): Unsubscribe
  onConnectionStateChange(cb: (state: ConnectionState) => void): Unsubscribe
  getConnectionState(): ConnectionState
  leave(): void
}

/** Opens the peer connection for a session code. */
export type JoinSession = (sessionId: string) => NetworkSession
