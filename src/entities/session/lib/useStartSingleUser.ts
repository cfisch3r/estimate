import { useNavigate } from 'react-router'
import { useSessionStore } from '../model/store'

/** Start a single-user (manual-entry) session and navigate to the workspace. */
export function useStartSingleUser(): () => void {
  const startSingleUser = useSessionStore((s) => s.startSingleUser)
  const navigate = useNavigate()

  return () => {
    startSingleUser()
    navigate('/workspace')
  }
}
