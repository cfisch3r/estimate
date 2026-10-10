import { normalizeSessionCode } from '../../domain/connection'
import { useConnectionStore, useRoundStore } from '../stores'
import { useLiveSession } from './useLiveSession'
import { useParticipantIdentity } from '../ports/participantIdentityContext'

/** Join a live session as a participant: normalise the code, fetch this client's id from the identity port, record the join in
 *  `connection.ts`, clear any stale round view left over from a previous session,
 *  and open the peer connection. The round is cleared here rather than in
 *  `connection.ts` itself so the stores stay independent of each other (see
 *  ADR-005). */
export function useJoinLiveSession(): (sessionCode: string, name: string) => void {
  const joinLiveSession = useConnectionStore((s) => s.joinLiveSession)
  const clearRound = useRoundStore((s) => s.clearRound)
  const { connect } = useLiveSession()
  const { getOrCreateParticipantId } = useParticipantIdentity()

  return (sessionCode, name) => {
    const code = normalizeSessionCode(sessionCode)
    if (joinLiveSession(code, name, getOrCreateParticipantId())) {
      clearRound()
      connect(code)
    }
  }
}
