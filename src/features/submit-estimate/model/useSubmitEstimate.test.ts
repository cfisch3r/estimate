import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useSubmitEstimate } from './useSubmitEstimate'
import { useConnectionStore, useRoundStore } from '../../../entities/session'

const { sendEstimateMock } = vi.hoisted(() => ({
  sendEstimateMock: vi.fn(() => Promise.resolve()),
}))

vi.mock('../../../entities/session/api/useNetworkSession', () => ({
  useNetworkSession: () => ({ sendEstimate: sendEstimateMock }),
}))

function setRound(submitted: boolean) {
  useConnectionStore.setState({ participantId: 'me' })
  useRoundStore.setState({
    liveRound: {
      item: { id: 'item-1', title: 'T', description: '' },
      round: 1,
      revealed: false,
      mySubmission: null,
      submissions: [],
      roster: [{ participantId: 'me', connected: true, submitted }],
    },
  })
}

beforeEach(() => {
  sendEstimateMock.mockReset()
  sendEstimateMock.mockImplementation(() => Promise.resolve())
})

describe('useSubmitEstimate', () => {
  it('reports sending until the roster shows the submission', () => {
    setRound(false)
    const { result } = renderHook(() => useSubmitEstimate())

    expect(result.current.deliveryState).toBe('sending')
  })

  it('reports submitted once the roster entry flips', () => {
    setRound(true)
    const { result } = renderHook(() => useSubmitEstimate())

    expect(result.current.deliveryState).toBe('submitted')
  })

  it('sends a valid estimate once and returns ok', () => {
    setRound(false)
    const { result } = renderHook(() => useSubmitEstimate())

    let outcome: ReturnType<typeof result.current.submit> | undefined
    act(() => {
      outcome = result.current.submit(2, 4, 8)
    })

    expect(outcome).toEqual({ ok: true })
    expect(sendEstimateMock).toHaveBeenCalledTimes(1)
  })

  it('reports not-delivered when the send rejects', async () => {
    setRound(false)
    sendEstimateMock.mockImplementation(() => Promise.reject(new Error('down')))
    const { result } = renderHook(() => useSubmitEstimate())

    act(() => {
      result.current.submit(2, 4, 8)
    })

    await waitFor(() => expect(result.current.deliveryState).toBe('not-delivered'))
  })

  it('does not send an estimate the store rejects', () => {
    setRound(false)
    const { result } = renderHook(() => useSubmitEstimate())

    let outcome: ReturnType<typeof result.current.submit> | undefined
    act(() => {
      outcome = result.current.submit(9, 4, 2)
    })

    expect(outcome?.ok).toBe(false)
    expect(sendEstimateMock).not.toHaveBeenCalled()
  })
})
