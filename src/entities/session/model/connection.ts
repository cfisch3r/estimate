import { create } from 'zustand'
import { getOrCreateParticipantId } from '../../participant'
import { firstPendingItemId, useSessionStore } from './session'
import type { LiveConnectionStatus, SessionMode, SessionRole } from './types'

interface ConnectionStore {
  mode: SessionMode
  role: SessionRole
  sessionId: string | null
  myName: string
  /** Stable per-browser id for this participant (persisted in `localStorage`, reused
   *  across joins/reconnects), used as the submission key. */
  participantId: string
  connectionStatus: LiveConnectionStatus
  /** Whether this client has reached at least one peer since joining the current
   *  session. Distinguishes "still trying to get in" from "was in, lost it" —
   *  the tracker can't, because it is rebuilt from scratch on every reconnect. */
  hasEverConnected: boolean
  peerCount: number
  /** Display names for every announced client in the session, keyed by the same
   *  `participantId` submissions carry. Seeded with this client's own entry on
   *  join; filled from peers' `announce` messages. */
  participantNames: Record<string, string>

  setMode: (mode: SessionMode) => void
  setConnectionStatus: (status: LiveConnectionStatus) => void
  setPeerCount: (count: number) => void
  /** Record a peer's (or own) `participantId -> display name` mapping. */
  applyParticipantName: (participantId: string, name: string) => void
  /** Facilitator: forget a departed peer's display name once its connection drops. */
  removeParticipant: (participantId: string) => void
  startSingleUser: () => void
  startCollaborative: (sessionCode: string) => void
  joinLiveSession: (sessionCode: string, name: string) => void
  leaveLiveSession: () => void
}

const CONNECTION_DEFAULTS = {
  mode: 'manual',
  role: 'facilitator',
  sessionId: null,
  myName: '',
  participantId: '',
  connectionStatus: 'idle',
  hasEverConnected: false,
  peerCount: 0,
  participantNames: {},
} as const satisfies Pick<
  ConnectionStore,
  | 'mode'
  | 'role'
  | 'sessionId'
  | 'myName'
  | 'participantId'
  | 'connectionStatus'
  | 'hasEverConnected'
  | 'peerCount'
  | 'participantNames'
>

export const useConnectionStore = create<ConnectionStore>((set) => ({
  ...CONNECTION_DEFAULTS,

  setMode: (mode) => set({ mode }),

  setConnectionStatus: (status) =>
    set((state) => ({
      connectionStatus: status,
      hasEverConnected: state.hasEverConnected || status === 'connected',
    })),

  setPeerCount: (count) => set({ peerCount: count }),

  applyParticipantName: (participantId, name) =>
    set((state) => ({
      participantNames: { ...state.participantNames, [participantId]: name },
    })),

  removeParticipant: (participantId) =>
    set((state) => {
      const { [participantId]: _removed, ...rest } = state.participantNames
      return { participantNames: rest }
    }),

  startSingleUser: () => {
    const { items, selectItem } = useSessionStore.getState()
    selectItem(firstPendingItemId(items))
  },

  startCollaborative: (sessionCode) => {
    const { items, selectItem } = useSessionStore.getState()
    selectItem(firstPendingItemId(items))
    set({
      mode: 'live',
      role: 'facilitator',
      sessionId: sessionCode,
      myName: 'Facilitator',
      participantNames: { facilitator: 'Facilitator' },
      connectionStatus: 'connecting',
      hasEverConnected: false,
      peerCount: 0,
    })
  },

  joinLiveSession: (sessionCode, name) => {
    const code = sessionCode.trim().toUpperCase()
    const trimmedName = name.trim()
    if (code.length === 0 || trimmedName.length === 0) return
    const participantId = getOrCreateParticipantId()
    set({
      mode: 'live',
      role: 'participant',
      sessionId: code,
      myName: trimmedName,
      participantId,
      participantNames: { [participantId]: trimmedName },
      connectionStatus: 'connecting',
      hasEverConnected: false,
      peerCount: 0,
    })
  },

  leaveLiveSession: () => {
    set({ ...CONNECTION_DEFAULTS })
    // A participant only ever inherits its unit from the facilitator's snapshot
    // (see round.ts's applySyncState); reset it here so a unit picked up from
    // one session doesn't leak into the user's next single-user/facilitator
    // workspace. `liveRound` (entities/session/model/round.ts) is cleared
    // alongside this by the composer hooks in features/session-lifecycle,
    // not here — round.ts already reads this store's `role`, so clearing the
    // round from here too would create a store import cycle (see ADR-005).
    useSessionStore.getState().setUnit('days')
  },
}))
