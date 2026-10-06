import { CircleNotchIcon } from '@phosphor-icons/react/dist/csr/CircleNotch'
import { GuardNote, LiveRegion } from '../../../shared/ui'
import type { DeliveryState } from '../model/useSubmitEstimate'

interface DeliveryStatusProps {
  state: DeliveryState
  /** Hide both notices — e.g. while a link-down banner already explains why
   *  nothing is arriving and a second alarm must not stack on top of it. */
  suppressed?: boolean
}

/** The participant-facing notices for where a just-submitted estimate stands
 *  with the facilitator: a spinner while sending, a retry banner when the send
 *  failed. Renders nothing for `submitted`. */
export function DeliveryStatus({ state, suppressed = false }: DeliveryStatusProps) {
  return (
    <>
      <LiveRegion>
        {!suppressed && state === 'sending' && (
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
      <LiveRegion>
        {!suppressed && state === 'not-delivered' && (
          <GuardNote variant="banner" headline="Not delivered yet">
            Your estimate hasn&apos;t reached the facilitator. It will retry
            automatically.
          </GuardNote>
        )}
      </LiveRegion>
    </>
  )
}
