/** The transport's view of the link to the session. */
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

/** The network layer's ConnectionStatus, plus 'idle' for "not in a live session". */
export type LiveConnectionStatus = ConnectionStatus | 'idle'
