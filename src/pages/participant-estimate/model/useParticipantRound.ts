import {
  useConnectionPhase,
  type ConnectionPhase,
} from '../../../shared/lib/useConnectionPhase'
import {
  useConnectionStore,
  useRoundStore,
  useSessionStore,
  type LiveRound,
} from '../../../entities/session'

/** "{sessionName} ({sessionId})" once the facilitator's session name has
 *  reached this client (see the sync protocol's `sessionName` field) — falls
 *  back to the join code alone (today's kicker) while it hasn't, e.g. an old
 *  facilitator build, or the brief window before the first snapshot lands. */
function formatSessionKicker(sessionName: string, sessionId: string | null): string {
  const trimmed = sessionName.trim()
  return trimmed ? `${trimmed} (${sessionId})` : `Session ${sessionId}`
}

/** The participant screen's read-model: which panel to show, plus the store
 *  values the panels share. Keeps the store fan-out out of the page component. */
export function useParticipantRound() {
  const sessionId = useConnectionStore((s) => s.sessionId)
  const sessionName = useSessionStore((s) => s.sessionName)
  const myName = useConnectionStore((s) => s.myName)
  const connectionStatus = useConnectionStore((s) => s.connectionStatus)
  const hasEverConnected = useConnectionStore((s) => s.hasEverConnected)
  const unit = useSessionStore((s) => s.unit)
  const peerCount = useConnectionStore((s) => s.peerCount)
  const participantId = useConnectionStore((s) => s.participantId)
  const participantNames = useConnectionStore((s) => s.participantNames)
  const liveRound = useRoundStore((s) => s.liveRound)
  // Down = we reached the session at some point and now hold no peers. Derived
  // from the store rather than the tracker's status because `connect()` builds a
  // fresh tracker: keying off status alone would clear the alarm the instant
  // Reconnect is pressed, hiding a rejoin that never succeeds.
  const connectionPhase: ConnectionPhase = useConnectionPhase(
    hasEverConnected && peerCount === 0,
  )

  const shared = {
    unit,
    kicker: formatSessionKicker(sessionName, sessionId),
    myName,
    connectionStatus,
    connectionPhase,
    participantId,
    participantNames,
  }

  // A discriminated union, so a caller that switches on `view` gets a non-null
  // `liveRound` in every round state without re-checking.
  if (!liveRound) return { ...shared, view: 'lobby' as const, liveRound: null }
  if (liveRound.revealed) {
    return {
      ...shared,
      view: 'revealed' as const,
      liveRound: liveRound satisfies LiveRound,
    }
  }
  if (liveRound.mySubmission) {
    return {
      ...shared,
      view: 'waiting' as const,
      liveRound,
      mySubmission: liveRound.mySubmission,
    }
  }
  return { ...shared, view: 'estimating' as const, liveRound }
}

export type RoundView = ReturnType<typeof useParticipantRound>['view']
