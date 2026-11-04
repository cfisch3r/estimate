import { useLayoutEffect } from 'react'
import { useNavigate } from 'react-router'
import { useConnectionStore } from '../../../application'
import { screenAccessFor } from '../../../domain/connection'
import { ROUTES } from '../../../shared/lib/routes'

/** Sends a visitor who shouldn't be on the participant estimate screen
 *  elsewhere: no joined session back to mode-select, a facilitator's own
 *  session back to their Workspace. In-memory state has no persist
 *  middleware, so a page reload resets the connection store to its defaults
 *  (`sessionId: null`) — without this, a reloaded participant sits on the
 *  estimate screen in a bogus "Connecting…" lobby state forever.
 *
 *  Checked only at mount, not reactively: leaving mid-session already clears
 *  `sessionId` and navigates away itself (`useLeaveLiveSession`), so watching
 *  it here too would fire a second, redundant navigate on top of it. A
 *  layout effect, not a plain effect, so the redirect lands before the
 *  browser paints — otherwise the one state this screen must never show
 *  (someone else's session, or none) would flash on screen first. */
export function useParticipantSessionGuard() {
  const navigate = useNavigate()

  useLayoutEffect(() => {
    const { mode, role, sessionId } = useConnectionStore.getState()
    const access = screenAccessFor({ mode, role, sessionId }, 'estimate')
    if (access !== 'allow') {
      navigate(ROUTES[access], { replace: true })
    }
  }, [navigate])
}
