import { useNavigate } from 'react-router'
import { useSessionStore } from '../model/store'

/** Start a facilitator-hosted live session and navigate to the workspace. */
export function useStartCollaborative(): (sessionCode: string) => void {
  const startCollaborative = useSessionStore((s) => s.startCollaborative)
  const navigate = useNavigate()

  return (sessionCode) => {
    startCollaborative(sessionCode)
    navigate('/workspace')
  }
}
