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

export function JoinSession() {
  const connectionStatus = useSessionStore((s) => s.connectionStatus)
  const joinLiveSession = useSessionStore((s) => s.joinLiveSession)
  const goToScreen = useSessionStore((s) => s.goToScreen)
  const { connect } = useNetworkSession()
  const leave = useLeaveLiveSession()

  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const canSubmit = code.trim().length > 0 && name.trim().length > 0
  const connecting = connectionStatus === 'connecting'
  const failed = connectionStatus === 'disconnected'

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

      {connecting && (
        <div
          className="card-meta"
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
        >
          <CircleNotchIcon size={16} weight="bold" className="spin" />
          Connecting to peers…
        </div>
      )}

      {failed && (
        <GuardNote variant="banner" headline="Couldn't reach the session">
          The peer connection failed. Ask the facilitator to double-check the code and try
          again, retry from another network or a VPN, or ask them to switch the session to
          manual entry.
        </GuardNote>
      )}

      <Button
        variant="primary"
        block
        onClick={handleJoin}
        disabled={!canSubmit || connecting}
      >
        {failed ? 'Retry' : 'Join'}
      </Button>

      <Button variant="ghost" onClick={leave}>
        ← Back
      </Button>
    </div>
  )
}
