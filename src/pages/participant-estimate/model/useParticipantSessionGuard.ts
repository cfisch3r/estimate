import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useConnectionStore } from '../../../application'
import { ROUTES } from '../../../shared/lib/routes'

/** Sends a visitor with no joined session back to mode-select. In-memory state
 *  has no persist middleware, so a page reload resets the connection store to
 *  its defaults (`sessionId: null`) — without this, a reloaded participant sits
 *  on the estimate screen in a bogus "Connecting…" lobby state forever.
 *
 *  Checked only at mount, not reactively: leaving mid-session already clears
 *  `sessionId` and navigates away itself (`useLeaveLiveSession`), so watching
 *  `sessionId` here too would fire a second, redundant navigate on top of it. */
export function useParticipantSessionGuard() {
  const navigate = useNavigate()

  useEffect(() => {
    if (useConnectionStore.getState().sessionId === null) {
      navigate(ROUTES.modeSelect, { replace: true })
    }
  }, [navigate])
}
