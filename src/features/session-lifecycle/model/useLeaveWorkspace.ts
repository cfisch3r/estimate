import { useNavigate } from 'react-router'
import { useCloseWorkspace } from '../../../application'
import { ROUTES } from '../../../shared/lib/routes'

/** Leave the workspace and navigate to mode-select (see `useCloseWorkspace`). */
export function useLeaveWorkspace(): {
  leaveWorkspace: () => void
  needsConfirm: boolean
} {
  const { closeWorkspace, needsConfirm } = useCloseWorkspace()
  const navigate = useNavigate()

  return {
    leaveWorkspace: () => {
      closeWorkspace()
      navigate(ROUTES.modeSelect)
    },
    needsConfirm,
  }
}
