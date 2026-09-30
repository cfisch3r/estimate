import { useNavigate } from 'react-router'
import { useSessionStore } from '../../../entities/session'
import { ROUTES } from '../../../shared/lib/routes'

/** Start a facilitator-hosted live session and navigate to the workspace. */
export function useStartCollaborative(): (sessionCode: string) => void {
  const startCollaborative = useSessionStore((s) => s.startCollaborative)
  const navigate = useNavigate()

  return (sessionCode) => {
    startCollaborative(sessionCode)
    navigate(ROUTES.workspace)
  }
}
