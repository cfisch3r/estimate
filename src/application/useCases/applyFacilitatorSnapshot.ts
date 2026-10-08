import { sessionFieldsFromSnapshot } from '../../domain/round'
import type { SessionSnapshot } from '../../domain/types'
import { useConnectionStore } from '../stores/connection'
import { useRoundStore } from '../stores/round'
import { useSessionStore } from '../stores/session'

/** Participant: adopt the facilitator's broadcast state. The session name and
 *  unit go to the session store (the name for participants only), the round view
 *  to the round store. Lives here, not in a store, because it spans three stores
 *  and the stores must not call each other (see ADR-005). The session fields are
 *  written first, as before, so the unit never lags behind the round it labels.
 *  Not a hook: the network bridge calls it from event callbacks. */
export function applyFacilitatorSnapshot(snapshot: SessionSnapshot): void {
  const fields = sessionFieldsFromSnapshot(useConnectionStore.getState().role, snapshot)
  const session = useSessionStore.getState()
  if (fields.sessionName !== undefined) session.setSessionName(fields.sessionName)
  session.setUnit(fields.unit)
  useRoundStore.getState().applySyncState(snapshot)
}
