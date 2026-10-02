import { useEffect, useRef, useState } from 'react'
import { CircleNotchIcon } from '@phosphor-icons/react/dist/csr/CircleNotch'
import { PencilSimpleIcon } from '@phosphor-icons/react/dist/csr/PencilSimple'
import { Button, Card, GuardNote, LiveRegion } from '../../../shared/ui'
import type { ConnectionPhase } from '../../../shared/lib/useConnectionPhase'
import { EstimateTriple, type EstimationUnit } from '../../../entities/estimate'
import type { LiveRound } from '../../../entities/session'
import type { DeliveryState, SubmitResult } from '../../../features/submit-estimate'
import { EstimateForm } from './EstimateForm'
import { RoundCardHeader } from './RoundCardHeader'

interface WaitingPanelProps {
  round: LiveRound
  unit: EstimationUnit
  kicker: string
  onSubmit: (best: number, likely: number, worst: number) => SubmitResult
  deliveryState: DeliveryState
  connectionPhase: ConnectionPhase
}

export function WaitingPanel({
  round,
  unit,
  kicker,
  onSubmit,
  deliveryState,
  connectionPhase,
}: WaitingPanelProps) {
  const [editing, setEditing] = useState(false)
  const reviseRef = useRef<HTMLButtonElement>(null)
  const wasEditing = useRef(false)
  const mine = round.mySubmission!

  // Revise / Update unmount the button or form that had focus; hand it to the
  // next control in the flow instead of letting it fall to <body>.
  useEffect(() => {
    if (editing) {
      document.getElementById('best')?.focus()
    } else if (wasEditing.current) {
      reviseRef.current?.focus()
    }
    wasEditing.current = editing
  }, [editing])

  return (
    <Card elevation="sm">
      <RoundCardHeader kicker={kicker} item={round.item} />

      {editing ? (
        <EstimateForm
          key={round.item.id}
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
              <EstimateTriple
                best={mine.best}
                likely={mine.likely}
                worst={mine.worst}
                unit={unit}
                emphasis
              />
            </span>
            <Button
              ref={reviseRef}
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
          <LiveRegion>
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
          </LiveRegion>
          <LiveRegion role="alert">
            {connectionPhase !== 'lost' && deliveryState === 'not-delivered' && (
              <GuardNote variant="banner" headline="Not delivered yet">
                Your estimate hasn&apos;t reached the facilitator. It will retry
                automatically.
              </GuardNote>
            )}
          </LiveRegion>
        </>
      )}
    </Card>
  )
}
