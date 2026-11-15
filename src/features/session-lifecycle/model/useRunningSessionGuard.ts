import { useLayoutEffect } from 'react'
import { useNavigate } from 'react-router'
import { useConnectionStore, useSessionStore } from '../../../application'
import { entryScreenAccess } from '../../../domain/connection'
import { ROUTES } from '../../../shared/lib/routes'

/** Sends a visitor of an entry screen back to a session that is still
 *  running (see `entryScreenAccess`): only the browser's Back button gets
 *  there that way. Checked only at mount, like `useParticipantSessionGuard`,
 *  and as a layout effect, so the entry screen never flashes on screen. */
export function useRunningSessionGuard(screen: 'modeSelect' | 'join') {
  const navigate = useNavigate()

  useLayoutEffect(() => {
    const { role, sessionId, hasEverConnected } = useConnectionStore.getState()
    const { started } = useSessionStore.getState()
    const access = entryScreenAccess(
      { role, sessionId, hasEverConnected },
      started,
      screen,
    )
    if (access !== 'allow') navigate(ROUTES[access], { replace: true })
  }, [navigate, screen])
}
