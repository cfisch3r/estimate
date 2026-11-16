import { useLayoutEffect } from 'react'
import { useNavigate } from 'react-router'
import {
  currentScreenAccess,
  useConnectionStore,
  useMarkSessionStarted,
} from '../../../application'
import { ROUTES } from '../../../shared/lib/routes'

/** Bounces a live participant off the single-user Workspace to the participant
 *  estimate screen, and marks any other visitor's session started. The normal join flow never lands a participant here, but a
 *  hand-typed `/workspace` would otherwise show them local, session-unrelated
 *  state with no way to reveal, retry or finalize.
 *
 *  A layout effect, not a plain effect, so the redirect lands before the
 *  browser paints — otherwise that session-unrelated state would flash on
 *  screen first. */
export function useWorkspaceLiveRedirect() {
  const mode = useConnectionStore((s) => s.mode)
  const role = useConnectionStore((s) => s.role)
  const sessionId = useConnectionStore((s) => s.sessionId)
  const navigate = useNavigate()
  const markStarted = useMarkSessionStarted()

  useLayoutEffect(() => {
    const access = currentScreenAccess('workspace')
    if (access !== 'allow') navigate(ROUTES[access], { replace: true })
    // mode/role/sessionId re-run the check when the connection changes.
  }, [mode, role, sessionId, navigate])

  useLayoutEffect(() => {
    // A Workspace reached without a start action (a reload, Forward, a typed
    // address) is still a running session for the browser's Back button.
    // Only on opening: leaving resets the stores a render before the route
    // changes, and marking then would revive the session just ended.
    if (currentScreenAccess('workspace') === 'allow') markStarted()
  }, [markStarted])
}
