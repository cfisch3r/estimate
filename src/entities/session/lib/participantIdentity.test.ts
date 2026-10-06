import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getOrCreateParticipantId } from './participantIdentity'

beforeEach(() => localStorage.clear())

describe('getOrCreateParticipantId', () => {
  it('mints a UUID and persists it on first call', () => {
    const id = getOrCreateParticipantId()

    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    expect(localStorage.getItem('estimate.participantId')).toBe(id)
  })

  it('returns the same id on a later call in the same browser', () => {
    const first = getOrCreateParticipantId()
    const second = getOrCreateParticipantId()

    expect(second).toBe(first)
  })

  it('mints a fresh id if the stored value is blank', () => {
    localStorage.setItem('estimate.participantId', '   ')

    const id = getOrCreateParticipantId()

    expect(id.trim().length).toBeGreaterThan(0)
    expect(id).not.toBe('   ')
  })

  it('falls back to an in-memory id when localStorage throws', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })

    const id = getOrCreateParticipantId()

    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    getItem.mockRestore()
  })
})
