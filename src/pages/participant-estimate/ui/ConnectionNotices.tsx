import { CircleNotchIcon } from '@phosphor-icons/react/dist/csr/CircleNotch'
import { Button, GuardNote, LiveRegion } from '../../../shared/ui'
import type { ConnectionPhase } from '../../../shared/lib/useConnectionPhase'

interface ConnectionNoticesProps {
  connectionPhase: ConnectionPhase
  onReconnect: () => void
  canReconnect: boolean
}

/** A dropped link usually rebuilds itself within seconds, so the first stage
 *  (`reconnecting`) stays quiet and offers no action — there is nothing useful to
 *  do yet. Only once that window passes (`lost`) is this a problem worth raising. */
export function ConnectionNotices({
  connectionPhase,
  onReconnect,
  canReconnect,
}: ConnectionNoticesProps) {
  return (
    <>
      <LiveRegion>
        {connectionPhase === 'reconnecting' && (
          <div
            className="card-meta"
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
          >
            <CircleNotchIcon size={16} weight="bold" className="spin" />
            Reconnecting…
          </div>
        )}
      </LiveRegion>

      <LiveRegion role="alert">
        {connectionPhase === 'lost' && (
          <GuardNote variant="banner" headline="Session connection lost">
            <p style={{ margin: '0 0 var(--space-2)' }}>
              You&apos;ve been disconnected and the session hasn&apos;t come back on its
              own.
            </p>
            <Button variant="primary" onClick={onReconnect} disabled={!canReconnect}>
              Reconnect
            </Button>
          </GuardNote>
        )}
      </LiveRegion>
    </>
  )
}
