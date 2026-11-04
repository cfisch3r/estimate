import { useLayoutEffect } from 'react'
import { useNavigate } from 'react-router'
import { useConnectionStore } from '../../../application'
import { screenAccessFor } from '../../../domain/connection'
import { ROUTES } from '../../../shared/lib/routes'

/** Bounces a live participant off the single-user Workspace to the participant
 *  estimate screen. The normal join flow never lands a participant here, but a
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

  const access = screenAccessFor({ mode, role, sessionId }, 'workspace')

  useLayoutEffect(() => {
    if (access !== 'allow') {
      navigate(ROUTES[access], { replace: true })
    }
  }, [access, navigate])
}
