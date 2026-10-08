import { describe, expect, it } from 'vitest'
import { deriveConnectionStatus } from './connection'
import type { ConnectionStatus, SessionRole } from './types'

const STATUSES: ConnectionStatus[] = ['connecting', 'connected', 'disconnected']

describe('deriveConnectionStatus', () => {
  it('holds a participant at connecting until the facilitator link is confirmed', () => {
    expect(deriveConnectionStatus('participant', 'connected', false)).toBe('connecting')
  })

  it('reports connected to a participant once the facilitator link is confirmed', () => {
    expect(deriveConnectionStatus('participant', 'connected', true)).toBe('connected')
  })

  it.each(STATUSES.filter((s) => s !== 'connected'))(
    'passes a participant %s status through unchanged',
    (status) => {
      expect(deriveConnectionStatus('participant', status, false)).toBe(status)
      expect(deriveConnectionStatus('participant', status, true)).toBe(status)
    },
  )

  it.each(STATUSES)('passes a facilitator %s status through unchanged', (status) => {
    const role: SessionRole = 'facilitator'
    expect(deriveConnectionStatus(role, status, false)).toBe(status)
    expect(deriveConnectionStatus(role, status, true)).toBe(status)
  })
})
