import { useNavigate } from 'react-router'
import {
  generateSessionCode,
  useConnectionStore,
  useNetworkSession,
} from '../../../entities/session'
import { ROUTES } from '../../../shared/lib/routes'

/** Start a facilitator-hosted live session: generate its join code, enter the
 *  workspace, and open the peer connection. */
export function useStartCollaborative(): () => void {
  const startCollaborative = useConnectionStore((s) => s.startCollaborative)
  const { connect } = useNetworkSession()
  const navigate = useNavigate()

  return () => {
    const sessionCode = generateSessionCode()
    startCollaborative(sessionCode)
    navigate(ROUTES.workspace)
    connect(sessionCode)
  }
}
