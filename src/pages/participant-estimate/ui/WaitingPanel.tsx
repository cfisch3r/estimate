import { useEffect, useRef, useState } from 'react'
import { CircleNotchIcon } from '@phosphor-icons/react/dist/csr/CircleNotch'
import { PencilSimpleIcon } from '@phosphor-icons/react/dist/csr/PencilSimple'
import { Button, Card, LiveRegion, VisuallyHidden } from '../../../shared/ui'
import type { ConnectionPhase } from '../../../shared/lib/useConnectionPhase'
import { EstimateTriple } from '../../../entities/session'
import type {
  ActionResult,
  EstimateValues,
  EstimationUnit,
} from '../../../domain/estimate'
import type { LiveRound } from '../../../domain/types'
import { DeliveryStatus } from './DeliveryStatus'
import type { DeliveryState } from '../../../application'
import { EstimateForm } from './EstimateForm'
import { RoundCardHeader } from './RoundCardHeader'

interface WaitingPanelProps {
  round: LiveRound
  /** This participant's own submitted values — the panel only shows once they exist. */
  mySubmission: EstimateValues
  unit: EstimationUnit
  kicker: string
  onSubmit: (best: number, likely: number, worst: number) => ActionResult
  deliveryState: DeliveryState
  connectionPhase: ConnectionPhase
}

export function WaitingPanel({
  round,
  mySubmission: mine,
  unit,
  kicker,
  onSubmit,
  deliveryState,
  connectionPhase,
}: WaitingPanelProps) {
  const [editing, setEditing] = useState(false)
  const [updated, setUpdated] = useState(false)
  const reviseRef = useRef<HTMLButtonElement>(null)
  const wasEditing = useRef(false)

  // Revise unmounts the button that had focus and Update unmounts the form: the
  // form focuses its own first input on mount, and Revise gets focus back here.
  useEffect(() => {
    if (!editing && wasEditing.current) reviseRef.current?.focus()
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
          focusOnMount
          onSubmit={(best, likely, worst) => {
            const result = onSubmit(best, likely, worst)
            if (result.ok) {
              setEditing(false)
              setUpdated(true)
            }
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
              onClick={() => {
                setUpdated(false)
                setEditing(true)
              }}
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
          <DeliveryStatus state={deliveryState} suppressed={connectionPhase === 'lost'} />
          <LiveRegion>
            <VisuallyHidden>{updated ? 'Estimate updated.' : ''}</VisuallyHidden>
          </LiveRegion>
        </>
      )}
    </Card>
  )
}
