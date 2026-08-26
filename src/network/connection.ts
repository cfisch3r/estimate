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
      peerIds.push(peerId)
      status = 'connected'
      notifyStateChange()
      for (const listener of peerJoinListeners) listener(peerId)
    },

    handlePeerLeave(peerId) {
      const index = peerIds.indexOf(peerId)
      if (index !== -1) peerIds.splice(index, 1)
      status = peerIds.length > 0 ? 'connected' : 'connecting'
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
