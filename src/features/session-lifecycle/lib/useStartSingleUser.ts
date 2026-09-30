import { useNavigate } from 'react-router'
import { useSessionStore } from '../../../entities/session'
import { ROUTES } from '../../../shared/lib/routes'

/** Start a single-user (manual-entry) session and navigate to the workspace. */
export function useStartSingleUser(): () => void {
  const startSingleUser = useSessionStore((s) => s.startSingleUser)
  const navigate = useNavigate()

  return () => {
    startSingleUser()
    navigate(ROUTES.workspace)
  }
}
