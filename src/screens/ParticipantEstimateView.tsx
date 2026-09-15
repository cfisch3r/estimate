import { useState } from 'react'
import { CircleNotchIcon } from '@phosphor-icons/react/dist/csr/CircleNotch'
import { PencilSimpleIcon } from '@phosphor-icons/react/dist/csr/PencilSimple'
import {
  Button,
  Card,
  CardBody,
  CardKicker,
  CardTitle,
  Field,
  FieldLabel,
  Input,
  GuardNote,
  RangeBar,
} from '../components'
import {
  checkAscendingOrder,
  checkFalsePrecision,
  checkSymmetricRange,
  computeCI90,
  createEstimate,
  aggregateEstimates,
  UNIT_GRANULARITY,
  UNIT_SUFFIX,
} from '../calc'
import type { EstimationUnit } from '../calc'
import { useSessionStore } from '../state/store'
import { useNetworkSession } from '../network'
import type { LiveRound } from '../state/types'
import { useLeaveLiveSession } from './useLeaveLiveSession'
import { useConnectionPhase, type ConnectionPhase } from './useConnectionPhase'

type SubmitResult = { ok: true } | { ok: false; error: string }

/** Where this participant's own estimate stands with the facilitator, derived
 *  rather than tracked as its own store field: `submitted` comes straight from
 *  the roster (the actual convergence proof, per ADR-003), so a background
 *  resend that lands is reflected automatically with no wiring back to this
 *  component. `sending` / `not-delivered` describe only the most recent local
 *  send attempt. */
type DeliveryState = 'sending' | 'submitted' | 'not-delivered'

const inputStyle = {
  height: 48,
  fontSize: '1.1rem',
  textAlign: 'center' as const,
  borderRadius: 'var(--radius-lg)',
}

interface EstimateFormProps {
  unit: EstimationUnit
  initial: { best: number; likely: number; worst: number } | null
  submitLabel: string
  statusLine?: string
  onSubmit: (best: number, likely: number, worst: number) => SubmitResult
}

/** The Best / Most likely / Worst input trio plus the live bias guards, shared by
 *  the estimating (5c) and revise-before-reveal (5d) states. Mirrors the guard
 *  wiring in Workspace's ActiveItemPanel, minus the facilitator-only finalize. */
function EstimateForm({
  unit,
  initial,
  submitLabel,
  statusLine,
  onSubmit,
}: EstimateFormProps) {
  const [best, setBest] = useState(initial ? String(initial.best) : '')
  const [likely, setLikely] = useState(initial ? String(initial.likely) : '')
  const [worst, setWorst] = useState(initial ? String(initial.worst) : '')
  const [submitError, setSubmitError] = useState<string | null>(null)

  const allFilled = best !== '' && likely !== '' && worst !== ''
  const bestNum = Number(best)
  const likelyNum = Number(likely)
  const worstNum = Number(worst)
  const granularity = UNIT_GRANULARITY[unit]

  const validation = allFilled
    ? createEstimate({
        participantId: 'preview',
        best: bestNum,
        likely: likelyNum,
        worst: worstNum,
      })
    : null
  const validationError = validation && !validation.ok ? validation.error : null

  const ascendingGuard = checkAscendingOrder(
    best === '' ? null : bestNum,
    likely === '' ? null : likelyNum,
    worst === '' ? null : worstNum,
  )
  const orderingWarning =
    !validationError && ascendingGuard.fired
      ? 'Values should ascend: best ≤ likely ≤ worst.'
      : null

  const symmetricGuard = allFilled
    ? checkSymmetricRange(bestNum, likelyNum, worstNum)
    : null
  const precisionNote = (raw: string) =>
    raw !== '' ? checkFalsePrecision(Number(raw), granularity) : null

  function handleSubmit() {
    const result = onSubmit(bestNum, likelyNum, worstNum)
    setSubmitError(result.ok ? null : result.error)
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
        <Field style={{ flex: 1 }}>
          <FieldLabel htmlFor="best">{`Best case (${unit})`}</FieldLabel>
          <Input
            id="best"
            type="number"
            min={0}
            value={best}
            onChange={(e) => setBest(e.target.value)}
            style={inputStyle}
          />
          {precisionNote(best)?.fired && (
            <GuardNote>Consider rounding to a meaningful value.</GuardNote>
          )}
        </Field>
        <Field style={{ flex: 1 }}>
          <FieldLabel htmlFor="likely">{`Most likely (${unit})`}</FieldLabel>
          <Input
            id="likely"
            type="number"
            min={0}
            value={likely}
            onChange={(e) => setLikely(e.target.value)}
            style={inputStyle}
          />
          {precisionNote(likely)?.fired && (
            <GuardNote>Consider rounding to a meaningful value.</GuardNote>
          )}
        </Field>
        <Field style={{ flex: 1 }}>
          <FieldLabel htmlFor="worst">{`Worst case (${unit})`}</FieldLabel>
          <Input
            id="worst"
            type="number"
            min={0}
            value={worst}
            onChange={(e) => setWorst(e.target.value)}
            style={inputStyle}
          />
          {precisionNote(worst)?.fired && (
            <GuardNote>Consider rounding to a meaningful value.</GuardNote>
          )}
        </Field>
      </div>

      <p
        style={{
          margin: 0,
          fontStyle: 'italic',
          fontSize: 14,
          color: 'var(--color-accent)',
          textAlign: 'center',
        }}
      >
        Would you stake your job this won&apos;t be exceeded?
      </p>

      {validation?.ok && (
        <RangeBar
          min={bestNum}
          max={worstNum}
          expected={likelyNum}
          ci90={computeCI90(likelyNum, bestNum, worstNum)}
          unitSuffix={UNIT_SUFFIX[unit]}
        />
      )}

      {symmetricGuard?.fired && (
        <GuardNote variant="banner" headline="Symmetric range">
          Worst case in software usually has more room than best case. Double check.
        </GuardNote>
      )}
      {(validationError || submitError) && (
        <GuardNote variant="banner" headline="Check your estimate">
          {validationError ?? submitError}
        </GuardNote>
      )}
      {orderingWarning && (
        <GuardNote variant="banner" headline="Out of order">
          {orderingWarning}
        </GuardNote>
      )}

      <Button variant="primary" disabled={!validation?.ok} onClick={handleSubmit}>
        {submitLabel}
      </Button>

      {statusLine && (
        <p
          className="text-muted"
          style={{ margin: 0, fontSize: 13, textAlign: 'center' }}
        >
          {statusLine}
        </p>
      )}
    </>
  )
}

interface RoundPanelProps {
  round: LiveRound
  unit: EstimationUnit
  sessionId: string | null
}

function EstimatingPanel({
  round,
  unit,
  sessionId,
  onSubmit,
}: RoundPanelProps & {
  onSubmit: (best: number, likely: number, worst: number) => SubmitResult
}) {
  // The roster (from the facilitator's snapshot) is the authoritative "who's
  // estimating" list — it replaces deriving the denominator from `peerCount`,
  // which is only correct while the full peer-to-peer mesh is intact.
  const totalEstimators = Math.max(round.roster.length, 1)
  const submitted = round.roster.filter((entry) => entry.submitted).length
  const statusLine = `${submitted} of ${totalEstimators} teammate${
    totalEstimators === 1 ? '' : 's'
  } ${submitted === 1 ? 'has' : 'have'} submitted so far.`

  return (
    <Card elevation="sm">
      <CardKicker>Session {sessionId}</CardKicker>
      <CardTitle>{round.item.title}</CardTitle>
      {round.item.description && (
        <CardBody className="card-body--authored">{round.item.description}</CardBody>
      )}
      <EstimateForm
        unit={unit}
        initial={null}
        submitLabel="Submit estimate"
        statusLine={statusLine}
        onSubmit={onSubmit}
      />
    </Card>
  )
}

function WaitingPanel({
  round,
  unit,
  sessionId,
  onSubmit,
  deliveryState,
  connectionPhase,
}: RoundPanelProps & {
  onSubmit: (best: number, likely: number, worst: number) => SubmitResult
  deliveryState: DeliveryState
  connectionPhase: ConnectionPhase
}) {
  const [editing, setEditing] = useState(false)
  const mine = round.mySubmission!
  const suffix = UNIT_SUFFIX[unit]

  return (
    <Card elevation="sm">
      <CardKicker>Session {sessionId}</CardKicker>
      <CardTitle>{round.item.title}</CardTitle>
      {round.item.description && (
        <CardBody className="card-body--authored">{round.item.description}</CardBody>
      )}

      {editing ? (
        <EstimateForm
          unit={unit}
          initial={mine}
          submitLabel="Update estimate"
          onSubmit={(best, likely, worst) => {
            const result = onSubmit(best, likely, worst)
            if (result.ok) setEditing(false)
            return result
          }}
        />
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-4)',
            }}
          >
            <span>
              <strong>{mine.best}</strong>
              {suffix} / <strong>{mine.likely}</strong>
              {suffix} / <strong>{mine.worst}</strong>
              {suffix}
            </span>
            <Button
              icon
              variant="ghost"
              aria-label="Revise estimate"
              onClick={() => setEditing(true)}
            >
              <PencilSimpleIcon size={16} />
            </Button>
          </div>
          <div
            className="card-meta"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-2)',
            }}
          >
            <CircleNotchIcon size={16} weight="bold" className="spin" />
            Waiting for the facilitator to reveal…
          </div>

          {/* When the facilitator link is down, that banner (rendered by the
           *  parent) already explains why nothing is arriving — this must not
           *  stack a second alarm on top of it. */}
          {connectionPhase !== 'lost' && deliveryState === 'sending' && (
            <div
              className="card-meta"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-2)',
              }}
            >
              <CircleNotchIcon size={16} weight="bold" className="spin" />
              Sending your estimate…
            </div>
          )}
          {connectionPhase !== 'lost' && deliveryState === 'not-delivered' && (
            <GuardNote variant="banner" headline="Not delivered yet">
              Your estimate hasn&apos;t reached the facilitator. It will retry
              automatically.
            </GuardNote>
          )}
        </>
      )}
    </Card>
  )
}

function RevealedPanel({
  round,
  unit,
  sessionId,
  participantId,
  participantNames,
}: RoundPanelProps & {
  participantId: string
  participantNames: Record<string, string>
}) {
  const suffix = UNIT_SUFFIX[unit]
  const aggregate =
    round.submissions.length > 0 ? aggregateEstimates(round.submissions) : null

  return (
    <Card elevation="sm">
      <CardKicker>Session {sessionId}</CardKicker>
      <CardTitle>{round.item.title}</CardTitle>
      {round.item.description && (
        <CardBody className="card-body--authored">{round.item.description}</CardBody>
      )}

      {aggregate ? (
        <RangeBar
          min={aggregate.min}
          max={aggregate.max}
          expected={aggregate.expected}
          ci90={aggregate.ci90}
          unitSuffix={suffix}
        />
      ) : (
        <CardBody>No estimates were submitted before the reveal.</CardBody>
      )}

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 4 }}>
        {(() => {
          // Every non-self row consumes a teammate number (whether or not it
          // also has an announced name), so a given peer's "Teammate N" stays
          // put when a *different* peer's announce arrives. Prefer the announced
          // name; `Object.hasOwn` guards against an untrusted participantId that
          // collides with an Object.prototype key ("toString", "constructor", …).
          let teammateNo = 0
          return round.submissions.map((estimate) => {
            const isMe = estimate.participantId === participantId
            const ordinal = isMe ? 0 : ++teammateNo
            const name = Object.hasOwn(participantNames, estimate.participantId)
              ? participantNames[estimate.participantId]
              : undefined
            const label = isMe ? 'You' : (name ?? `Teammate ${ordinal}`)
            return (
              <li
                key={estimate.participantId}
                style={{ display: 'flex', justifyContent: 'space-between' }}
              >
                <span>{label}</span>
                <span>
                  {estimate.best}
                  {suffix} / {estimate.likely}
                  {suffix} / {estimate.worst}
                  {suffix}
                </span>
              </li>
            )
          })
        })()}
      </ul>

      <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
        Waiting for the facilitator to finalize or start a new round.
      </p>
    </Card>
  )
}

interface LobbyProps {
  sessionId: string | null
  myName: string
  connectionStatus: string
  connectionPhase: ConnectionPhase
}

function Lobby({ sessionId, myName, connectionStatus, connectionPhase }: LobbyProps) {
  // While the connection is down, the spinner or banner below owns the
  // explanation — the card must not also claim to be "Establishing the peer
  // connection", which reads as a first join that never happened.
  if (connectionPhase !== 'ok') {
    return (
      <Card elevation="sm">
        <CardKicker>Session {sessionId}</CardKicker>
        <CardTitle>Session interrupted</CardTitle>
        <CardBody>You were in the session; the connection dropped.</CardBody>
      </Card>
    )
  }

  return (
    <Card elevation="sm">
      <CardKicker>Session {sessionId}</CardKicker>
      <CardTitle>
        {connectionStatus === 'connected' ? `You're in, ${myName}` : 'Connecting…'}
      </CardTitle>
      <CardBody>
        {connectionStatus === 'connected'
          ? 'Waiting for the facilitator to start the first item.'
          : 'Establishing the peer connection.'}
      </CardBody>
    </Card>
  )
}

export function ParticipantEstimateView() {
  const sessionId = useSessionStore((s) => s.sessionId)
  const myName = useSessionStore((s) => s.myName)
  const connectionStatus = useSessionStore((s) => s.connectionStatus)
  const hasEverConnected = useSessionStore((s) => s.hasEverConnected)
  const unit = useSessionStore((s) => s.unit)
  const peerCount = useSessionStore((s) => s.peerCount)
  const participantId = useSessionStore((s) => s.participantId)
  const participantNames = useSessionStore((s) => s.participantNames)
  const liveRound = useSessionStore((s) => s.liveRound)
  const submitEstimate = useSessionStore((s) => s.submitEstimate)
  const leave = useLeaveLiveSession()
  const { sendEstimate, connect } = useNetworkSession()
  // Down = we reached the session at some point and now hold no peers. Derived
  // from the store rather than the tracker's status because `connect()` builds a
  // fresh tracker: keying off status alone would clear the alarm the instant
  // Reconnect is pressed, hiding a rejoin that never succeeds.
  const connectionPhase = useConnectionPhase(hasEverConnected && peerCount === 0)
  // Tracks only the most recent local send attempt; the roster convergence
  // check in NetworkProvider can also resend in the background, and that path
  // is reflected below purely through the roster, without touching this flag.
  const [deliveryFailed, setDeliveryFailed] = useState(false)

  function handleSubmit(best: number, likely: number, worst: number): SubmitResult {
    const result = submitEstimate(best, likely, worst)
    if (result.ok) {
      if (liveRound) {
        setDeliveryFailed(false)
        sendEstimate(liveRound.item.id, result.estimate, liveRound.round).catch(() => {
          setDeliveryFailed(true)
        })
      }
      return { ok: true }
    }
    return result
  }

  const myRosterEntry = liveRound?.roster.find(
    (entry) => entry.participantId === participantId,
  )
  const deliveryState: DeliveryState = myRosterEntry?.submitted
    ? 'submitted'
    : deliveryFailed
      ? 'not-delivered'
      : 'sending'

  let panel
  if (!liveRound) {
    panel = (
      <Lobby
        sessionId={sessionId}
        myName={myName}
        connectionStatus={connectionStatus}
        connectionPhase={connectionPhase}
      />
    )
  } else if (liveRound.revealed) {
    panel = (
      <RevealedPanel
        round={liveRound}
        unit={unit}
        sessionId={sessionId}
        participantId={participantId}
        participantNames={participantNames}
      />
    )
  } else if (liveRound.mySubmission) {
    panel = (
      <WaitingPanel
        round={liveRound}
        unit={unit}
        sessionId={sessionId}
        onSubmit={handleSubmit}
        deliveryState={deliveryState}
        connectionPhase={connectionPhase}
      />
    )
  } else {
    panel = (
      <EstimatingPanel
        round={liveRound}
        unit={unit}
        sessionId={sessionId}
        onSubmit={handleSubmit}
      />
    )
  }

  return (
    <div
      style={{
        maxWidth: 560,
        margin: '0 auto',
        padding: 'var(--space-8) var(--space-4)',
        display: 'grid',
        gap: 'var(--space-4)',
      }}
    >
      {panel}

      {/* A dropped link usually rebuilds itself within seconds, so the first
       *  stage stays quiet and offers no action — there is nothing useful to do
       *  yet. Only once that window passes is this a problem worth raising. */}
      {connectionPhase === 'reconnecting' && (
        <div
          className="card-meta"
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
        >
          <CircleNotchIcon size={16} weight="bold" className="spin" />
          Reconnecting…
        </div>
      )}

      {connectionPhase === 'lost' && (
        <GuardNote variant="banner" headline="Session connection lost">
          <p style={{ margin: '0 0 var(--space-2)' }}>
            You&apos;ve been disconnected and the session hasn&apos;t come back on its
            own.
          </p>
          <Button
            variant="primary"
            onClick={() => sessionId && connect(sessionId)}
            disabled={!sessionId}
          >
            Reconnect
          </Button>
        </GuardNote>
      )}

      <Button variant="ghost" onClick={leave}>
        Leave session
      </Button>
    </div>
  )
}
