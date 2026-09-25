import { useEffect, useState } from 'react'
import { CircleNotchIcon } from '@phosphor-icons/react/dist/csr/CircleNotch'
import {
  Button,
  Card,
  CardKicker,
  Field,
  FieldLabel,
  GuardNote,
  Input,
} from '../components'
import { useSessionStore } from '../state/store'
import { useNetworkSession } from '../network'
import { useLeaveLiveSession } from './useLeaveLiveSession'
import { useConnectionPhase } from './useConnectionPhase'

export function JoinSession() {
  const connectionStatus = useSessionStore((s) => s.connectionStatus)
  const joinLiveSession = useSessionStore((s) => s.joinLiveSession)
  const goToScreen = useSessionStore((s) => s.goToScreen)
  const { connect } = useNetworkSession()
  const leave = useLeaveLiveSession()

  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [attempt, setAttempt] = useState(0)

  const canSubmit = code.trim().length > 0 && name.trim().length > 0
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
      goToScreen('estimate')
    }
  }, [submitted, connectionStatus, goToScreen])

  function handleJoin() {
    if (!canSubmit) return
    const trimmedCode = code.trim().toUpperCase()
    setSubmitted(true)
    setAttempt((a) => a + 1)
    joinLiveSession(trimmedCode, name)
    connect(trimmedCode)
  }

  return (
    <div
      style={{
        maxWidth: 440,
        margin: '0 auto',
        padding: 'var(--space-8) var(--space-4)',
        display: 'grid',
        gap: 'var(--space-4)',
      }}
    >
      <div>
        <h1>Join a live session</h1>
        <p className="text-muted">
          Enter the code your facilitator shared and the name your team will see.
        </p>
      </div>

      <Card elevation="sm">
        <CardKicker>Session</CardKicker>
        <Field>
          <FieldLabel htmlFor="session-code">Session code</FieldLabel>
          <Input
            id="session-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="K7F9Q2"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="your-name">Your name</FieldLabel>
          <Input
            id="your-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Sam Rivera"
            autoComplete="name"
          />
        </Field>
      </Card>

      <GuardNote>
        Joining from another tab in this browser will be treated as the same person —
        don&rsquo;t estimate from two tabs at once.
      </GuardNote>

      {connecting && !failed && (
        <div
          className="card-meta"
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
        >
          <CircleNotchIcon size={16} weight="bold" className="spin" />
          Connecting to peers…
        </div>
      )}

      {failed && (
        // Retry is the only action offered on purpose: there is no facilitator-side
        // control to switch a session or item to Manual Entry mid-flight (ADR-003,
        // "Also explicitly out of scope" under Role-asymmetric link state), so this
        // must not suggest one.
        <GuardNote variant="banner" headline="Couldn't reach the session">
          We couldn&rsquo;t reach the facilitator. Double-check the session code with them
          and try again.
        </GuardNote>
      )}

      <Button
        variant="primary"
        block
        onClick={handleJoin}
        disabled={!canSubmit || (connecting && !failed)}
      >
        {failed ? 'Retry' : 'Join'}
      </Button>

      <Button variant="ghost" onClick={leave}>
        ← Back
      </Button>
    </div>
  )
}
