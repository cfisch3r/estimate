import type { AggregateResult } from '../calc'

export interface Item {
  id: string
  title: string
  description: string
  notes: string
  finalResult: AggregateResult | null
}

export type ScreenId = 'create' | 'session' | 'summary' | 'history'
