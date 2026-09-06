import { joinRoom } from 'trystero/nostr'
import { createConnectionTracker, type ConnectionState } from './connection'
import { createTypedActions, type ActionRoom, type SessionSnapshot } from './actions'
import type { Estimate } from '../calc'

const APP_ID = 'estimate-app-v1'

type Unsubscribe = () => void

export interface JoinSessionOptions {
  password?: string
}

export interface NetworkSession {
  sendEstimate(estimate: Estimate): void
  sendSyncState(snapshot: SessionSnapshot): void
  sendReveal(itemId: string): void
  onEstimate(cb: (estimate: Estimate, peerId: string) => void): Unsubscribe
  onSyncState(cb: (snapshot: SessionSnapshot, peerId: string) => void): Unsubscribe
  onReveal(cb: (itemId: string, peerId: string) => void): Unsubscribe
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
    sendReveal: actions.sendReveal,
    onEstimate: actions.onEstimate,
    onSyncState: actions.onSyncState,
    onReveal: actions.onReveal,
    onPeerJoin: connection.onPeerJoin,
    onPeerLeave: connection.onPeerLeave,
    onConnectionStateChange: connection.onStateChange,
    getConnectionState: connection.getState,
    leave: () => room.leave(),
  }
}
