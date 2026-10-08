import { useNavigate } from 'react-router'
import { useStartSingleUserSession } from '../../../application'
import { ROUTES } from '../../../shared/lib/routes'

/** Start a single-user (manual-entry) session and navigate to the workspace. */
export function useStartSingleUser(): () => void {
  const startSession = useStartSingleUserSession()
  const navigate = useNavigate()

  return () => {
    startSession()
    navigate(ROUTES.workspace)
  }
}
