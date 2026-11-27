import { sessionFieldsFromSnapshot } from '../../domain/snapshot'
import type { SessionSnapshot } from '../../domain/types'
import { useRoundStore } from '../stores/round'
import { useSessionStore } from '../stores/session'

/** Participant: adopt the facilitator's snapshot. The session name and unit go
 *  to the session store, the round view to the round store. Lives here, not in
 *  a store, because it spans two stores and the stores must not call each other
 *  (see ADR-005). The session fields are written first, so the unit never lags
 *  behind the round it labels. Not a hook: the network bridge calls it from
 *  event callbacks. */
export function applyFacilitatorSnapshot(snapshot: SessionSnapshot): void {
  const fields = sessionFieldsFromSnapshot(snapshot)
  const session = useSessionStore.getState()
  session.setSessionName(fields.sessionName)
  session.setUnit(fields.unit)
  useRoundStore.getState().applyRoundSnapshot(snapshot)
}
