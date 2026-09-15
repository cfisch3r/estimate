import { joinRoom } from 'trystero/nostr'
import { createConnectionTracker, type ConnectionState } from './connection'
import {
  createTypedActions,
  type ActionRoom,
  type ParticipantAnnounce,
  type SessionSnapshot,
} from './actions'
import type { Estimate } from '../calc'

const APP_ID = 'estimate-app-v1'

type Unsubscribe = () => void

export interface JoinSessionOptions {
  password?: string
}

export interface NetworkSession {
  sendEstimate(itemId: string, estimate: Estimate, round: number, target: string): Promise<void>
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

/** Joins the Trystero room for a session. roomId = sessionId, the 6-char code from
 *  `generateSessionCode()` that the facilitator shares out of band (no deep link).
 *  Uses the Nostr signaling strategy per docs/architecture.md. */
export function joinSession(
  sessionId: string,
  options: JoinSessionOptions = {},
): NetworkSession {
  const connection = createConnectionTracker()

  const room = joinRoom({ appId: APP_ID, password: options.password }, sessionId, {
    onJoinError: () => connection.handleJoinError(),
  }) as unknown as ActionRoom & {
    onPeerJoin: ((peerId: string) => void) | null
    onPeerLeave: ((peerId: string) => void) | null
    leave: () => void
  }

  const actions = createTypedActions(room)

  room.onPeerJoin = (peerId) => connection.handlePeerJoin(peerId)
  room.onPeerLeave = (peerId) => connection.handlePeerLeave(peerId)

  return {
    sendEstimate: actions.sendEstimate,
    sendSyncState: actions.sendSyncState,
    sendAnnounce: actions.sendAnnounce,
    requestSnapshot: actions.requestSnapshot,
    onEstimate: actions.onEstimate,
    onSyncState: actions.onSyncState,
    onAnnounce: actions.onAnnounce,
    onRequestSnapshot: actions.onRequestSnapshot,
    onPeerJoin: connection.onPeerJoin,
    onPeerLeave: connection.onPeerLeave,
    onConnectionStateChange: connection.onStateChange,
    getConnectionState: connection.getState,
    leave: () => room.leave(),
  }
}
