import { describe, expect, it, vi } from 'vitest'
import { createConnectionTracker } from './connection'

describe('createConnectionTracker', () => {
  it('starts connecting with no peers', () => {
    const tracker = createConnectionTracker()
    expect(tracker.getState()).toEqual({ status: 'connecting', peerIds: [] })
  })

  it('transitions to connected when the first peer joins', () => {
    const tracker = createConnectionTracker()
    tracker.handlePeerJoin('peer-1')
    expect(tracker.getState()).toEqual({ status: 'connected', peerIds: ['peer-1'] })
  })

  it('tracks multiple peers joining', () => {
    const tracker = createConnectionTracker()
    tracker.handlePeerJoin('peer-1')
    tracker.handlePeerJoin('peer-2')
    expect(tracker.getState()).toEqual({
      status: 'connected',
      peerIds: ['peer-1', 'peer-2'],
    })
  })

  it('removes a peer on leave, staying connected while others remain', () => {
    const tracker = createConnectionTracker()
    tracker.handlePeerJoin('peer-1')
    tracker.handlePeerJoin('peer-2')
    tracker.handlePeerLeave('peer-1')
    expect(tracker.getState()).toEqual({ status: 'connected', peerIds: ['peer-2'] })
  })

  it('goes back to connecting when the last peer leaves', () => {
    const tracker = createConnectionTracker()
    tracker.handlePeerJoin('peer-1')
    tracker.handlePeerLeave('peer-1')
    expect(tracker.getState()).toEqual({ status: 'connecting', peerIds: [] })
  })

  it('sets status to disconnected on a join error', () => {
    const tracker = createConnectionTracker()
    tracker.handleJoinError()
    expect(tracker.getState()).toEqual({ status: 'disconnected', peerIds: [] })
  })

  it('notifies subscribers on state change', () => {
    const tracker = createConnectionTracker()
    const cb = vi.fn()
    tracker.onStateChange(cb)

    tracker.handlePeerJoin('peer-1')

    expect(cb).toHaveBeenCalledWith({ status: 'connected', peerIds: ['peer-1'] })
  })

  it('stops notifying after unsubscribe', () => {
    const tracker = createConnectionTracker()
    const cb = vi.fn()
    const unsubscribe = tracker.onStateChange(cb)
    unsubscribe()

    tracker.handlePeerJoin('peer-1')

    expect(cb).not.toHaveBeenCalled()
  })

  it('fires peer-join subscribers with the joining peer id', () => {
    const tracker = createConnectionTracker()
    const cb = vi.fn()
    tracker.onPeerJoin(cb)

    tracker.handlePeerJoin('peer-1')

    expect(cb).toHaveBeenCalledWith('peer-1')
  })

  it('fires peer-leave subscribers with the leaving peer id', () => {
    const tracker = createConnectionTracker()
    const cb = vi.fn()
    tracker.handlePeerJoin('peer-1')
    tracker.onPeerLeave(cb)

    tracker.handlePeerLeave('peer-1')

    expect(cb).toHaveBeenCalledWith('peer-1')
  })
})
