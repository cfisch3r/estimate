import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useConnectionStore } from '../../../application'
import { useConnectionPhase } from '../../../shared/lib/useConnectionPhase'
import { ROUTES } from '../../../shared/lib/routes'
import { useJoinLiveSession } from '../../../application/useCases/useJoinLiveSession'

/** The participant's join attempt as a small flow: `join` starts it, `connecting`
 *  / `failed` describe where it stands, and it navigates onward to the estimate
 *  screen once the facilitator link is confirmed. */
export function useJoinFlow() {
  const connectionStatus = useConnectionStore((s) => s.connectionStatus)
  const joinLiveSession = useJoinLiveSession()
  const navigate = useNavigate()
  const [submitted, setSubmitted] = useState(false)
  const [attempt, setAttempt] = useState(0)

  const connecting = connectionStatus === 'connecting'
  // A participant's connectionStatus now only reaches 'connected' once the
  // facilitator's own link is confirmed (#62) — so 'connecting' held past the
  // same self-healing grace used for a mid-session drop means the facilitator
  // was never reached, not just "still setting up". A hard onJoinError
  // ('disconnected') escalates immediately; it isn't the kind of blip the
  // grace period exists to absorb.
  //
  // `attempt` forces the grace timer to restart on Retry: a rejoin tears down
  // and reconnects while connectionStatus stays 'connecting' throughout, so
  // the boolean alone would never signal a fresh attempt.
  const connectionPhase = useConnectionPhase(submitted && connecting, attempt)
  const failed = connectionStatus === 'disconnected' || connectionPhase === 'lost'

  // Only this client's own join attempt should navigate onward — not a 'connected'
  // status left in the store by some other flow.
  useEffect(() => {
    if (submitted && connectionStatus === 'connected') {
      navigate(ROUTES.estimate)
    }
  }, [submitted, connectionStatus, navigate])

  function join(sessionCode: string, name: string) {
    setSubmitted(true)
    setAttempt((a) => a + 1)
    joinLiveSession(sessionCode, name)
  }

  return { join, connecting, failed }
}
