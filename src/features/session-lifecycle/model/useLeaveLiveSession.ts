import { useNavigate } from 'react-router'
import { ROUTES } from '../../../shared/lib/routes'
import { useTeardownLiveSession } from '../../../application/useCases/useTeardownLiveSession'

/** Tear down the current live session and navigate back to mode-select. */
export function useLeaveLiveSession(): () => void {
  const teardownLiveSession = useTeardownLiveSession()
  const navigate = useNavigate()

  return () => {
    teardownLiveSession()
    navigate(ROUTES.modeSelect)
  }
}
