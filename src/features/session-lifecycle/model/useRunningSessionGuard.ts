import { useLayoutEffect } from 'react'
import { useNavigate } from 'react-router'
import { currentScreenAccess } from '../../../application'
import { ROUTES } from '../../../shared/lib/routes'

/** Sends a visitor of an entry screen back to a session that is still
 *  running (see `screenAccessFor`): only the browser's Back button gets
 *  there that way. Checked only at mount, like `useParticipantSessionGuard`,
 *  and as a layout effect, so the entry screen never flashes on screen. The
 *  navigation state lets the header say why Back seemed to do nothing. */
export function useRunningSessionGuard(screen: 'modeSelect' | 'join') {
  const navigate = useNavigate()

  useLayoutEffect(() => {
    const access = currentScreenAccess(screen)
    if (access !== 'allow') {
      navigate(ROUTES[access], { replace: true, state: { stillRunning: true } })
    }
  }, [navigate, screen])
}
