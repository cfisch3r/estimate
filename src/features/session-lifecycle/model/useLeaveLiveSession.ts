import { useNavigate } from 'react-router'
import { useEndSession } from '../../../application'
import { ROUTES } from '../../../shared/lib/routes'

/** Tear down the current live session and navigate back to mode-select. */
export function useLeaveLiveSession(): () => void {
  const endSession = useEndSession()
  const navigate = useNavigate()

  return () => {
    endSession()
    navigate(ROUTES.modeSelect)
  }
}
