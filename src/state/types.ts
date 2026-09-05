import type { AggregateResult } from '../calc'
import type { ConnectionStatus } from '../network/connection'

export interface Item {
  id: string
  title: string
  description: string
  notes: string
  finalResult: AggregateResult | null
}

export type ScreenId = 'create' | 'session' | 'summary' | 'history' | 'join' | 'estimate'

export type SessionMode = 'manual' | 'live'

export type SessionRole = 'facilitator' | 'participant'

/** The network layer's ConnectionStatus, plus 'idle' for "not in a live session". */
export type LiveConnectionStatus = ConnectionStatus | 'idle'
