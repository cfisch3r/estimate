import { describe, expect, it } from 'vitest'
import { createEstimate, type Estimate } from './estimate'
import { needsResend } from './resend'
import type { LiveRound } from './types'

function mine(best: number, likely: number, worst: number): Estimate {
  const result = createEstimate({ participantId: 'me', best, likely, worst })
  if (!result.ok) throw new Error(result.error)
  return result.value
}

function round(overrides: Partial<LiveRound> = {}): LiveRound {
  return {
    item: { id: 'i', title: 'T', description: '' },
    submissions: [],
    revealed: false,
    round: 0,
    roster: [{ participantId: 'me', submitted: false, connected: true }],
    mySubmission: mine(1, 2, 3),
    ...overrides,
  }
}

describe('needsResend', () => {
  it('is true when I submitted locally but the roster does not show it', () => {
    expect(needsResend(round(), 'me')).toBe(true)
  })

  it('is true when my roster entry is missing entirely', () => {
    expect(needsResend(round({ roster: [] }), 'me')).toBe(true)
  })

  it('is false once the roster shows my submission', () => {
    const live = round({
      roster: [{ participantId: 'me', submitted: true, connected: true }],
    })
    expect(needsResend(live, 'me')).toBe(false)
  })

  it('is false with no round, after reveal, or before I have submitted', () => {
    expect(needsResend(null, 'me')).toBe(false)
    expect(needsResend(round({ revealed: true }), 'me')).toBe(false)
    expect(needsResend(round({ mySubmission: null }), 'me')).toBe(false)
  })
})
