import { beforeEach, describe, expect, it } from 'vitest'
import { useConnectionStore } from './connection'
import { useSessionStore } from './session'

function resetStore() {
  localStorage.clear()
  useSessionStore.setState({
    sessionName: '',
    unit: 'days',
    items: [],
    activeItemId: null,
  })
  useConnectionStore.setState({
    mode: 'manual',
    role: 'facilitator',
    sessionId: null,
    myName: '',
    participantId: '',
    connectionStatus: 'idle',
    hasEverConnected: false,
    peerCount: 0,
    participantNames: {},
  })
}

beforeEach(resetStore)

describe('startCollaborative', () => {
  it('enters a live facilitator session with no items yet', () => {
    useConnectionStore.getState().startCollaborative('K7F9Q2')

    const state = useConnectionStore.getState()
    expect(state).toMatchObject({
      mode: 'live',
      role: 'facilitator',
      sessionId: 'K7F9Q2',
      connectionStatus: 'connecting',
    })
  })

  it('leaves the item selection to the session store', () => {
    useSessionStore.getState().addItem('First item')
    useSessionStore.getState().selectItem(null)
    useConnectionStore.getState().startCollaborative('K7F9Q2')

    expect(useSessionStore.getState().activeItemId).toBeNull()
  })

  it("seeds the facilitator's own display name", () => {
    useConnectionStore.getState().startCollaborative('K7F9Q2')
    expect(useConnectionStore.getState().participantNames).toEqual({
      facilitator: 'Facilitator',
    })
  })
})

describe('joinLiveSession', () => {
  it('ignores a blank code or blank name, reporting it did not proceed', () => {
    expect(useConnectionStore.getState().joinLiveSession('   ', 'Sam')).toBe(false)
    expect(useConnectionStore.getState().joinLiveSession('K7F9Q2', '   ')).toBe(false)
    expect(useConnectionStore.getState().mode).toBe('manual')
  })

  it('enters a connecting participant session, normalising the code, and reports it proceeded', () => {
    expect(
      useConnectionStore.getState().joinLiveSession('  k7f9q2 ', '  Sam Rivera  '),
    ).toBe(true)

    expect(useConnectionStore.getState()).toMatchObject({
      mode: 'live',
      role: 'participant',
      sessionId: 'K7F9Q2',
      myName: 'Sam Rivera',
      connectionStatus: 'connecting',
    })
  })

  it('reuses the same participantId across a drop and rejoin in the same browser', () => {
    useConnectionStore.getState().joinLiveSession('K7F9Q2', 'Sam')
    const firstId = useConnectionStore.getState().participantId

    useConnectionStore.getState().leaveLiveSession()
    useConnectionStore.getState().joinLiveSession('K7F9Q2', 'Sam')

    expect(useConnectionStore.getState().participantId).toBe(firstId)
  })

  it('assigns a stable participant id on join', () => {
    useConnectionStore.getState().joinLiveSession('K7F9Q2', 'Sam')
    expect(useConnectionStore.getState().participantId).toMatch(/[0-9a-f-]{36}/)
  })

  it("seeds the participant's own trimmed display name against their id", () => {
    useConnectionStore.getState().joinLiveSession('K7F9Q2', '  Sam Rivera  ')
    const { participantId, participantNames } = useConnectionStore.getState()
    expect(participantNames).toEqual({ [participantId]: 'Sam Rivera' })
  })
})

describe('leaveLiveSession', () => {
  it('resets every live field', () => {
    useConnectionStore.getState().joinLiveSession('K7F9Q2', 'Sam')
    useConnectionStore.getState().setConnectionStatus('connected')
    useConnectionStore.getState().setPeerCount(3)

    useConnectionStore.getState().leaveLiveSession()

    expect(useConnectionStore.getState()).toMatchObject({
      mode: 'manual',
      role: 'facilitator',
      sessionId: null,
      myName: '',
      participantId: '',
      connectionStatus: 'idle',
      peerCount: 0,
    })
  })

  it('clears participantNames on leave', () => {
    useConnectionStore.getState().joinLiveSession('K7F9Q2', 'Sam')
    useConnectionStore.getState().applyParticipantName('peer-1', 'Jordan')
    useConnectionStore.getState().leaveLiveSession()
    expect(useConnectionStore.getState().participantNames).toEqual({})
  })
})

describe('applyParticipantName', () => {
  it('inserts and overwrites entries without disturbing the rest of the map', () => {
    useConnectionStore.getState().applyParticipantName('a', 'Ada')
    useConnectionStore.getState().applyParticipantName('b', 'Bo')
    useConnectionStore.getState().applyParticipantName('a', 'Ada L.')

    expect(useConnectionStore.getState().participantNames).toEqual({
      a: 'Ada L.',
      b: 'Bo',
    })
  })
})

describe('removeParticipant', () => {
  it('deletes only the named entry', () => {
    useConnectionStore.getState().applyParticipantName('a', 'Ada')
    useConnectionStore.getState().applyParticipantName('b', 'Bo')

    useConnectionStore.getState().removeParticipant('a')

    expect(useConnectionStore.getState().participantNames).toEqual({ b: 'Bo' })
  })

  it('is a no-op for an id that was never announced', () => {
    useConnectionStore.getState().applyParticipantName('a', 'Ada')

    useConnectionStore.getState().removeParticipant('never-announced')

    expect(useConnectionStore.getState().participantNames).toEqual({ a: 'Ada' })
  })
})

describe('connection mirrors', () => {
  it('setConnectionStatus and setPeerCount update just those fields', () => {
    useConnectionStore.getState().setConnectionStatus('connected')
    useConnectionStore.getState().setPeerCount(2)
    expect(useConnectionStore.getState().connectionStatus).toBe('connected')
    expect(useConnectionStore.getState().peerCount).toBe(2)
  })
})
