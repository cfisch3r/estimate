import { useLayoutEffect } from 'react'
import { useNavigate } from 'react-router'
import { useSessionStore } from '../../../application'
import { ROUTES } from '../../../shared/lib/routes'

/** Sends a visitor back to the Workspace when a mode is still running on the
 *  session. Only the browser's Back button gets here that way: the app's own
 *  leave button resets the session first. Without this, Back would skip the
 *  unsaved-changes confirmation (Join, then Back, resets the session) and
 *  offer a load that would replace a live session's items under its
 *  participants. Checked only at mount, like `useParticipantSessionGuard`,
 *  and as a layout effect, so mode selection never flashes on screen. */
export function useStartedSessionGuard() {
  const navigate = useNavigate()

  useLayoutEffect(() => {
    if (useSessionStore.getState().started) {
      navigate(ROUTES.workspace, { replace: true })
    }
  }, [navigate])
}
