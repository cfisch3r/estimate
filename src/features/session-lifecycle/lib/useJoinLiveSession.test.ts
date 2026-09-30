import { beforeEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useConnectionStore, useRoundStore } from '../../../entities/session'
import { useJoinLiveSession } from './useJoinLiveSession'

function resetStore() {
  useConnectionStore.setState({ mode: 'manual', sessionId: null })
  useRoundStore.setState({
    liveRound: {
      item: { id: 'stale-item', title: 'Stale', description: '' },
      submissions: [],
      revealed: false,
      round: 0,
      roster: [],
      mySubmission: null,
    },
  })
}

beforeEach(resetStore)

describe('useJoinLiveSession', () => {
  it('joins and clears the stale round view on a valid code and name', () => {
    const { result } = renderHook(() => useJoinLiveSession())

    result.current('K7F9Q2', 'Sam')

    expect(useConnectionStore.getState().sessionId).toBe('K7F9Q2')
    expect(useRoundStore.getState().liveRound).toBeNull()
  })

  it('does not clear the round view when the join is a no-op (blank code or name)', () => {
    const { result } = renderHook(() => useJoinLiveSession())

    result.current('   ', 'Sam')

    expect(useConnectionStore.getState().mode).toBe('manual')
    expect(useRoundStore.getState().liveRound).not.toBeNull()
  })
})
