import { leaveConfirmation } from '../../domain/connection'
import type { LeaveConfirmation } from '../../domain/connection'
import { useConnectionStore } from '../stores'
import { useSaveState } from './useSaveState'
import { useTeardownLiveSession } from './useTeardownLiveSession'

/** Tear down the workspace entirely: the live session (if any) and the item
 *  list. This is the one place that has to know "leaving" spans all three stores
 *  (see ADR-005). Navigation is the caller's. */
export function useCloseWorkspace(): {
  closeWorkspace: () => void
  /** Why the caller should ask for a second click before leaving, if at all:
   *  unsaved changes would be lost, or live peers would lose their session. */
  confirmation: LeaveConfirmation
} {
  const mode = useConnectionStore((s) => s.mode)
  const peerCount = useConnectionStore((s) => s.peerCount)
  const { unsaved } = useSaveState()
  const teardownLiveSession = useTeardownLiveSession()

  return {
    closeWorkspace: teardownLiveSession,
    confirmation: leaveConfirmation(mode, peerCount, unsaved),
  }
}
