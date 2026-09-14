export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

export interface ConnectionState {
  status: ConnectionStatus
  peerIds: string[]
}

type Unsubscribe = () => void

export interface ConnectionTracker {
  getState(): ConnectionState
  handlePeerJoin(peerId: string): void
  handlePeerLeave(peerId: string): void
  handleJoinError(): void
  onStateChange(cb: (state: ConnectionState) => void): Unsubscribe
  onPeerJoin(cb: (peerId: string) => void): Unsubscribe
  onPeerLeave(cb: (peerId: string) => void): Unsubscribe
}

export function createConnectionTracker(): ConnectionTracker {
  const peerIds: string[] = []
  let status: ConnectionStatus = 'connecting'
  // Once we've had at least one peer, losing them all is a connection *loss*
  // ('disconnected'), not the initial pre-join wait ('connecting') — the two
  // need different UI (silent lobby spinner vs. a reconnect prompt).
  let hasConnectedOnce = false

  const stateChangeListeners = new Set<(state: ConnectionState) => void>()
  const peerJoinListeners = new Set<(peerId: string) => void>()
  const peerLeaveListeners = new Set<(peerId: string) => void>()

  const getState = (): ConnectionState => ({ status, peerIds: [...peerIds] })

  const notifyStateChange = () => {
    const state = getState()
    for (const listener of stateChangeListeners) listener(state)
  }

  return {
    getState,

    handlePeerJoin(peerId) {
      if (peerIds.includes(peerId)) return
      peerIds.push(peerId)
      status = 'connected'
      hasConnectedOnce = true
      notifyStateChange()
      for (const listener of peerJoinListeners) listener(peerId)
    },

    handlePeerLeave(peerId) {
      const index = peerIds.indexOf(peerId)
      if (index !== -1) peerIds.splice(index, 1)
      status =
        peerIds.length > 0 ? 'connected' : hasConnectedOnce ? 'disconnected' : 'connecting'
      notifyStateChange()
      for (const listener of peerLeaveListeners) listener(peerId)
    },

    handleJoinError() {
      status = 'disconnected'
      notifyStateChange()
    },

    onStateChange(cb) {
      stateChangeListeners.add(cb)
      return () => stateChangeListeners.delete(cb)
    },

    onPeerJoin(cb) {
      peerJoinListeners.add(cb)
      return () => peerJoinListeners.delete(cb)
    },

    onPeerLeave(cb) {
      peerLeaveListeners.add(cb)
      return () => peerLeaveListeners.delete(cb)
    },
  }
}
