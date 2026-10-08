import { useNavigate } from 'react-router'
import { useStartCollaborativeSession } from '../../../application'
import { ROUTES } from '../../../shared/lib/routes'

/** Start a facilitator-hosted live session and enter the workspace. */
export function useStartCollaborative(): () => void {
  const startSession = useStartCollaborativeSession()
  const navigate = useNavigate()

  return () => {
    startSession()
    navigate(ROUTES.workspace)
  }
}
