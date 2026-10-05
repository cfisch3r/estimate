import { useNavigate } from 'react-router'
import { useSessionStore } from '../../../entities/session'
import { ROUTES } from '../../../shared/lib/routes'

/** Start a single-user (manual-entry) session and navigate to the workspace. */
export function useStartSingleUser(): () => void {
  const selectFirstPending = useSessionStore((s) => s.selectFirstPending)
  const navigate = useNavigate()

  return () => {
    selectFirstPending()
    navigate(ROUTES.workspace)
  }
}
