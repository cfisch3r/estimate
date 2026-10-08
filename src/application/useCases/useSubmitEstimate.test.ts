import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useSubmitEstimate } from './useSubmitEstimate'
import { useConnectionStore, useRoundStore } from '../../entities/session'

const { sendEstimateMock } = vi.hoisted(() => ({
  sendEstimateMock: vi.fn(() => Promise.resolve()),
}))

vi.mock('../ports/useNetworkSession', () => ({
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

  it('does not record or send an invalid estimate', () => {
    setRound(false)
    const { result } = renderHook(() => useSubmitEstimate())

    let outcome: ReturnType<typeof result.current.submit> | undefined
    act(() => {
      outcome = result.current.submit(9, 4, 2)
    })

    expect(outcome?.ok).toBe(false)
    expect(sendEstimateMock).not.toHaveBeenCalled()
    expect(useRoundStore.getState().liveRound?.mySubmission).toBeNull()
  })

  it('records a valid estimate under the local participant id and sends it once', () => {
    setRound(false)
    const { result } = renderHook(() => useSubmitEstimate())

    act(() => {
      result.current.submit(2, 4, 8)
    })

    expect(useRoundStore.getState().liveRound?.mySubmission).toMatchObject({
      participantId: 'me',
      best: 2,
      likely: 4,
      worst: 8,
    })
    expect(sendEstimateMock).toHaveBeenCalledTimes(1)
    expect(sendEstimateMock).toHaveBeenCalledWith(
      'item-1',
      expect.objectContaining({ participantId: 'me', best: 2, likely: 4, worst: 8 }),
      1,
    )
  })

  it('fails without sending when there is no active round', () => {
    useRoundStore.setState({ liveRound: null })
    const { result } = renderHook(() => useSubmitEstimate())

    let outcome: ReturnType<typeof result.current.submit> | undefined
    act(() => {
      outcome = result.current.submit(2, 4, 8)
    })

    expect(outcome?.ok).toBe(false)
    expect(sendEstimateMock).not.toHaveBeenCalled()
  })

  it('sends the item id and round the store holds at call time, not at render time', () => {
    setRound(false)
    const { result } = renderHook(() => useSubmitEstimate())
    // A submit closure captured before the facilitator moved to the next round.
    const staleSubmit = result.current.submit
    act(() => {
      useRoundStore.setState((state) => ({
        liveRound: state.liveRound && {
          ...state.liveRound,
          item: { id: 'item-2', title: 'Next', description: '' },
          round: 3,
        },
      }))
    })

    act(() => {
      staleSubmit(2, 4, 8)
    })

    expect(sendEstimateMock).toHaveBeenCalledTimes(1)
    expect(sendEstimateMock).toHaveBeenCalledWith(
      'item-2',
      expect.objectContaining({ best: 2, likely: 4, worst: 8 }),
      3,
    )
  })

  it('fails without sending when the round was cleared after the last render', () => {
    setRound(false)
    const { result } = renderHook(() => useSubmitEstimate())
    const staleSubmit = result.current.submit
    act(() => {
      useRoundStore.setState({ liveRound: null })
    })

    let outcome: ReturnType<typeof staleSubmit> | undefined
    act(() => {
      outcome = staleSubmit(2, 4, 8)
    })

    expect(outcome?.ok).toBe(false)
    expect(sendEstimateMock).not.toHaveBeenCalled()
  })
})
