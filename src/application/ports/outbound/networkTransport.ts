import type { Estimate } from '../../../domain/estimate'
import type {
  ConnectionStatus,
  ParticipantAnnounce,
  SessionSnapshot,
} from '../../../domain/types'

// The peer transport the live-session controller talks to. The application layer
// owns this interface; `adapters/network` implements it (ADR-009). No React here,
// so adapters may import it.

type Unsubscribe = () => void

/** The transport's own view of the link: its status and the peers it can reach. */
export interface ConnectionState {
  status: ConnectionStatus
  peerIds: string[]
}

/** What a live session offers both roles: announcing themselves, seeing peers
 *  come and go, and leaving. */
export interface LiveSession {
  sendAnnounce(announce: ParticipantAnnounce): void
  onAnnounce(cb: (announce: ParticipantAnnounce, peerId: string) => void): Unsubscribe
  onPeerJoin(cb: (peerId: string) => void): Unsubscribe
  onPeerLeave(cb: (peerId: string) => void): Unsubscribe
  onConnectionStateChange(cb: (state: ConnectionState) => void): Unsubscribe
  getConnectionState(): ConnectionState
  leave(): void
}

/** The facilitator's side of a live session: it owns the session's state, sends
 *  it to everyone, collects the estimates and answers a newcomer's snapshot
 *  request. It never takes a snapshot from anyone. */
export interface FacilitatorSession extends LiveSession {
  sendSnapshot(snapshot: SessionSnapshot): void
  onEstimate(
    cb: (
      itemId: string,
      estimate: Estimate,
      peerId: string,
      round: number | undefined,
    ) => void,
  ): Unsubscribe
  /** Answers a peer's `requestSnapshot` pull. */
  onSnapshotRequest(cb: () => SessionSnapshot): Unsubscribe
}

/** A participant's side of a live session: everything it sends goes to the
 *  facilitator, and the only snapshots it takes are the facilitator's. The
 *  facilitator is the peer that announced the facilitator's participant id. */
export interface ParticipantSession extends LiveSession {
  /** Whether the facilitator's peer is known: set by its announce, replaced by
   *  a later one from another peer, cleared when that peer leaves. */
  hasFacilitator(): boolean
  /** Fires whenever the facilitator's peer changes: `true` when a facilitator
   *  announced itself (again, under a new peer), `false` when it left. */
  onFacilitatorChange(cb: (present: boolean) => void): Unsubscribe
  /** Sends this participant's estimate to the facilitator and resolves once it
   *  acknowledges it. Rejects with a Trystero request error (`error.kind`:
   *  `timeout` | `disconnected` | `aborted` | a generic rejection), and with
   *  `disconnected` while no facilitator is known (ADR-003, "Acknowledged
   *  submissions"). */
  sendEstimate(itemId: string, estimate: Estimate, round: number): Promise<void>
  /** Pulls the facilitator's current snapshot (ADR-003, "Snapshot delivery: pull
   *  on arrival"). Rejects like `sendEstimate`. */
  requestSnapshot(): Promise<SessionSnapshot>
  onFacilitatorSnapshot(cb: (snapshot: SessionSnapshot) => void): Unsubscribe
}

/** Opens the peer connection for a session code, shaped for the role. */
export interface JoinSession {
  asFacilitator(sessionId: string): FacilitatorSession
  asParticipant(sessionId: string): ParticipantSession
}
