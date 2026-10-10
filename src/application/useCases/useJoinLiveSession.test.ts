import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderHook } from '@testing-library/react'
import { ParticipantIdentityContext } from '../ports/participantIdentityContext'
import { useConnectionStore, useRoundStore } from '../stores'
import { useJoinLiveSession } from './useJoinLiveSession'

const { connectMock } = vi.hoisted(() => ({ connectMock: vi.fn() }))

vi.mock('./useLiveSession', () => ({
  useLiveSession: () => ({ connect: connectMock }),
}))

const getIdMock = vi.fn(() => 'p-1')

function wrapper({ children }: { children: ReactNode }) {
  return createElement(
    ParticipantIdentityContext.Provider,
    { value: { getOrCreateParticipantId: getIdMock } },
    children,
  )
}

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

beforeEach(() => {
  connectMock.mockClear()
  getIdMock.mockClear()
  resetStore()
})

describe('useJoinLiveSession', () => {
  it('joins and clears the stale round view on a valid code and name', () => {
    const { result } = renderHook(() => useJoinLiveSession(), { wrapper })

    result.current('K7F9Q2', 'Sam')

    expect(useConnectionStore.getState().sessionId).toBe('K7F9Q2')
    expect(useRoundStore.getState().liveRound).toBeNull()
    expect(connectMock).toHaveBeenCalledTimes(1)
    expect(connectMock).toHaveBeenCalledWith('K7F9Q2')
  })

  it('records the id the identity port returns', () => {
    const { result } = renderHook(() => useJoinLiveSession(), { wrapper })

    result.current('K7F9Q2', 'Sam')

    expect(useConnectionStore.getState().participantId).toBe('p-1')
    expect(getIdMock).toHaveBeenCalledTimes(1)
  })

  it('normalises the code before joining and connecting', () => {
    const { result } = renderHook(() => useJoinLiveSession(), { wrapper })

    result.current('  k7f9q2 ', 'Sam')

    expect(useConnectionStore.getState().sessionId).toBe('K7F9Q2')
    expect(connectMock).toHaveBeenCalledWith('K7F9Q2')
  })

  it('does not clear the round view when the join is a no-op (blank code or name)', () => {
    const { result } = renderHook(() => useJoinLiveSession(), { wrapper })

    result.current('   ', 'Sam')

    expect(useConnectionStore.getState().mode).toBe('manual')
    expect(useRoundStore.getState().liveRound).not.toBeNull()
    expect(connectMock).not.toHaveBeenCalled()
  })
})
